import { coverPath } from '@/lib/book-paths'
import type { Book } from '@/lib/db/books'
import type { Db } from '@/lib/db/db'
import {
  applyRemoteChanges,
  clearDeletions,
  clearDownloadedCover,
  getDriveFolders,
  listBooksMissingCover,
  listBooksToUpload,
  markBookUploaded,
  readLocalLibrary,
  saveDownloadedCover,
  type AppliedChanges,
  type DriveFolders,
} from '@/lib/db/sync'
import { DriveAuthError } from '@/lib/drive/auth-error'
import { isDriveApiError, type DriveApi, type DriveApiError } from '@/lib/drive/api'
import { exportFileName } from '@/lib/epub/export-name'
import { ensureFolders, MissingFolderError } from './folders'
import { parseLibraryFile, serializeLibraryFile, UnsupportedLibraryFormat } from './library-file'
import { mergeLibrary } from './merge'

const LIBRARY_FILE = 'biblioteca.json'
const EPUB_TYPE = 'application/epub+zip'
// Rounds of "read, merge, write" when another device writes in between.
const WRITE_ATTEMPTS = 3
const COVER_DOWNLOADS = 4

export interface SyncDeps {
  db: Db
  api: DriveApi
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, bytes: Uint8Array): Promise<void>
  deleteFiles(paths: (string | null)[]): void
  // A trava da biblioteca (library-lock): aplicar mudanças e marcar envios não
  // pode cruzar com importar, editar ou excluir.
  lock<T>(fn: () => Promise<T>): Promise<T>
  log?(event: string, detail?: string): void
}

export interface SyncSummary {
  // Records this device took from the others (books, progress, highlights).
  applied: number
  // Of those, the books that arrived from another device and the ones removed there.
  booksAdded: number
  booksRemoved: number
  uploaded: number
  // Books Drive refused, or whose file here can't be read (see
  // uploadPendingBooks); they stay pending.
  skipped: number
  covers: number
}

// The books going up in this sync; a refused one counts as done.
export interface UploadProgress {
  done: number
  total: number
}

export type SyncProblem = 'offline' | 'conta' | 'cheio' | 'pasta' | 'formato' | 'conflito' | 'erro'

export class SyncError extends Error {
  readonly problem: SyncProblem

  // The books that arrived from another device or were removed there before
  // the sync failed: they're in the library already and still get announced.
  booksAdded = 0
  booksRemoved = 0

  constructor(problem: SyncProblem, message: string) {
    super(message)
    this.problem = problem
  }
}

const running = new WeakMap<Db, Promise<SyncSummary>>()

// Uma por vez por banco: quem chama durante uma recebe a mesma.
// onApplied fires once the records from the other devices are in, before this
// device's own uploads, which on a first sync can take minutes; onProgress
// follows those uploads, book by book.
export function syncNow(
  deps: SyncDeps,
  onApplied?: () => void,
  onProgress?: (progress: UploadProgress) => void,
): Promise<SyncSummary> {
  let run = running.get(deps.db)
  if (!run) {
    run = runSync(deps, onApplied, onProgress).finally(() => running.delete(deps.db))
    running.set(deps.db, run)
  }
  return run
}

const nothingApplied = (): AppliedChanges => ({ booksAdded: 0, booksRemoved: 0, other: 0, filesToDelete: [] })
const total = (changes: AppliedChanges) => changes.booksAdded + changes.booksRemoved + changes.other

// Adds b into a, in place.
function addTo(a: AppliedChanges, b: AppliedChanges): void {
  a.booksAdded += b.booksAdded
  a.booksRemoved += b.booksRemoved
  a.other += b.other
  a.filesToDelete.push(...b.filesToDelete)
}

async function runSync(
  deps: SyncDeps,
  onApplied?: () => void,
  onProgress?: (progress: UploadProgress) => void,
): Promise<SyncSummary> {
  const started = Date.now()
  deps.log?.('sync: início')
  // Filled in as the records from the other side are applied, so a sync that
  // fails afterwards (writing the file back, an upload) still reports them.
  const received = nothingApplied()
  try {
    // A device's first sync adds both sides up (spec: "primeira conexão"). The
    // removals it recorded before were local ones — the dialog said so — and
    // must not delete those same books on the other devices.
    if (!(await getDriveFolders(deps.db))) {
      const dropped = await clearDeletions(deps.db)
      deps.log?.('sync: primeira deste aparelho', `${dropped} exclusão(ões) de antes descartada(s)`)
    }
    const folders = await ensureFolders(deps.db, deps.api)
    await syncLibraryFile(deps, folders, received)
    if (total(received) > 0) onApplied?.()
    const { uploaded, skipped, stoppedBy } = await uploadPendingBooks(deps, folders, onProgress)
    // A book is only in the file once its EPUB is on Drive. The books that went
    // up just now get in with this second round, which is what makes them
    // appear on the other devices; it runs even when the uploads stopped early.
    if (uploaded > 0) await syncLibraryFile(deps, folders, received)
    const covers = await downloadMissingCovers(deps)
    if (stoppedBy) throw stoppedBy
    const applied = total(received)
    deps.log?.(
      'sync: fim',
      `${applied} recebida(s), ${uploaded} enviado(s), ${skipped} recusado(s), ${covers} capa(s), ${Date.now() - started} ms`,
    )
    return { applied, booksAdded: received.booksAdded, booksRemoved: received.booksRemoved, uploaded, skipped, covers }
  } catch (error) {
    const problem = toSyncError(error)
    problem.booksAdded = received.booksAdded
    problem.booksRemoved = received.booksRemoved
    deps.log?.('sync: erro', `${problem.problem}: ${String(error)}`)
    throw problem
  }
}

// Steps 3 to 6 of the spec: read the shared file, merge, apply here, and write
// the result back if it differs, unless another device wrote it in between
// (then the whole round starts over).
// What it applies here is added into applied as it happens.
async function syncLibraryFile(deps: SyncDeps, folders: DriveFolders, applied: AppliedChanges): Promise<void> {
  const { api } = deps
  for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt++) {
    const ref = await api.findFile(LIBRARY_FILE, folders.data)
    // The version as the file itself reports it: a search can lag behind a
    // write, and comparing against that would look like a conflict every time.
    const version = ref ? await api.getVersion(ref.id) : null
    const theirs = ref ? parseLibraryFile(await api.downloadText(ref.id)) : null
    if (ref && !theirs) deps.log?.('sync: biblioteca ilegível, será regravada')
    const { file, changes } = mergeLibrary(await readLocalLibrary(deps.db), theirs)
    // Os arquivos que ficaram sem dono saem na mesma trava: um livro
    // reimportado logo depois não perde o arquivo novo.
    const result = await deps.lock(async () => {
      const done = await applyRemoteChanges(deps.db, changes)
      deps.deleteFiles(done.filesToDelete)
      return done
    })
    addTo(applied, result)
    const text = serializeLibraryFile(file)
    if (theirs && text === serializeLibraryFile(theirs)) {
      deps.log?.('sync: biblioteca em dia', `${Object.keys(file.books).length} livro(s)`)
      return
    }
    if (ref && (await api.getVersion(ref.id)) !== version) {
      deps.log?.('sync: biblioteca mudou no meio', `tentativa ${attempt}`)
      continue
    }
    const content = new TextEncoder().encode(text)
    if (ref) await api.updateFile(ref.id, content, 'application/json')
    else await api.createFile({ name: LIBRARY_FILE, parentId: folders.data, mimeType: 'application/json' }, content)
    deps.log?.('sync: biblioteca gravada', `${Object.keys(file.books).length} livro(s)`)
    return
  }
  throw new SyncError('conflito', 'Outro aparelho estava sincronizando ao mesmo tempo. Tente de novo.')
}

function coverType(path: string): { extension: string; mimeType: string } {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  if (extension === 'png') return { extension, mimeType: 'image/png' }
  if (extension === 'webp') return { extension, mimeType: 'image/webp' }
  return { extension: 'jpg', mimeType: 'image/jpeg' }
}

// Never edited since it was imported: any device's copy of it is the same book.
const unedited = (book: Book) => book.fileUpdatedAt === book.addedAt

// A book Drive refuses, which is skipped and counted so it can't hold the
// rest of the library back: a 4xx that isn't a full Drive or a "slow down"
// (its file deleted by hand on Drive, say), or a big upload whose session
// address couldn't be read.
function refused(error: unknown): boolean {
  if (!isDriveApiError(error)) return false
  if (error.reason === 'noUploadSession') return true
  return error.status >= 400 && error.status < 500 && !isTransient(error) && error.reason !== 'storageQuotaExceeded'
}

// Step 7: the EPUB and the cover of each pending book, one book at a time. A
// file already on Drive for the book (an upload cut short, or the same book
// added on another device) is reused rather than duplicated. Anything other
// than a refused book (a full Drive, no network, a "slow down") stops the
// uploads; what went up so far is still put in the library file.
async function uploadPendingBooks(
  deps: SyncDeps,
  folders: DriveFolders,
  onProgress?: (progress: UploadProgress) => void,
): Promise<{ uploaded: number; skipped: number; stoppedBy: unknown }> {
  const { api } = deps
  let uploaded = 0
  let skipped = 0
  const pending = await listBooksToUpload(deps.db)
  if (pending.length > 0) onProgress?.({ done: 0, total: pending.length })
  for (const [index, book] of pending.entries()) {
    const expected = { updatedAt: book.updatedAt, fileUpdatedAt: book.fileUpdatedAt }
    // Um arquivo daqui que não abre (apagado por fora, corrompido) conta como
    // recusado e não trava os livros seguintes.
    let bytes: Uint8Array
    let cover: Uint8Array | null
    try {
      bytes = await deps.readFile(book.filePath)
      cover = book.coverPath ? await deps.readFile(book.coverPath) : null
    } catch (error) {
      skipped++
      deps.log?.('sync: arquivo daqui ilegível', `${book.title}: ${String(error)}`)
      onProgress?.({ done: index + 1, total: pending.length })
      continue
    }
    try {
      let fileId = book.driveFileId
      if (!fileId) {
        const found = await api.findBookFile(book.id, folders.root)
        if (found && !unedited(book)) await api.updateFile(found, bytes, EPUB_TYPE)
        fileId =
          found ??
          (
            await api.createFile(
              {
                name: exportFileName(book),
                parentId: folders.root,
                mimeType: EPUB_TYPE,
                appProperties: { bookId: book.id },
              },
              bytes,
            )
          ).id
      } else {
        await api.updateFile(fileId, bytes, EPUB_TYPE)
      }

      let coverId = book.driveCoverId
      if (book.coverPath && cover) {
        const { extension, mimeType } = coverType(book.coverPath)
        coverId ??= await api.findBookFile(book.id, folders.covers)
        if (coverId) {
          if (book.driveCoverId || !unedited(book)) await api.updateFile(coverId, cover, mimeType)
        } else {
          coverId = (
            await api.createFile(
              {
                name: `${book.id}.${extension}`,
                parentId: folders.covers,
                mimeType,
                appProperties: { bookId: book.id },
              },
              cover,
            )
          ).id
        }
      }

      const refs = { driveFileId: fileId, driveCoverId: coverId }
      await deps.lock(() => markBookUploaded(deps.db, book.id, refs, expected))
      uploaded++
      deps.log?.('sync: livro enviado', `${book.title} (${bytes.length} bytes)`)
    } catch (error) {
      if (!refused(error)) return { uploaded, skipped, stoppedBy: error }
      skipped++
      deps.log?.('sync: livro não enviado', `${book.title}: ${String(error)}`)
    }
    onProgress?.({ done: index + 1, total: pending.length })
  }
  return { uploaded, skipped, stoppedBy: null }
}

// A extensão pelos primeiros bytes: o Drive não diz o tipo no download.
function coverExtension(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'webp'
  return 'jpg'
}

// Step 8: covers the books from other devices arrived without, a few at a time.
async function downloadMissingCovers(deps: SyncDeps): Promise<number> {
  const queue = await listBooksMissingCover(deps.db)
  let downloaded = 0
  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        const { id, driveCoverId } = next
        const bytes = await deps.api.downloadBytes(driveCoverId)
        const path = coverPath(id, coverExtension(bytes))
        // Na trava e só se o livro ainda espera esta capa: uma edição feita
        // durante o download não perde a capa nova. O registro vai antes do
        // arquivo para que o arquivo só seja escrito se for mesmo usado.
        const saved = await deps.lock(async () => {
          if (!(await saveDownloadedCover(deps.db, id, path, driveCoverId))) return false
          try {
            await deps.writeFile(path, bytes)
          } catch (error) {
            await clearDownloadedCover(deps.db, id, path)
            throw error
          }
          return true
        })
        if (saved) downloaded++
      } catch (error) {
        deps.log?.('sync: capa não baixada', `${next.id.slice(0, 8)} ${String(error)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(COVER_DOWNLOADS, queue.length) }, worker))
  return downloaded
}

// Drive says "slow down" with a 429, and also with a 403 whose reason is a
// rate limit; like a 5xx, it passes if tried again later.
function isTransient(error: DriveApiError): boolean {
  return (
    error.status === 429 ||
    error.status >= 500 ||
    error.reason === 'rateLimitExceeded' ||
    error.reason === 'userRateLimitExceeded'
  )
}

function toSyncError(error: unknown): SyncError {
  if (error instanceof SyncError) return error
  if (error instanceof DriveAuthError) {
    if (error.problem === 'indisponivel') return new SyncError('offline', 'Sem conexão com o Google Drive.')
    return new SyncError('conta', 'Conecte o Google Drive de novo para sincronizar.')
  }
  if (error instanceof MissingFolderError) {
    return new SyncError(
      'pasta',
      `A pasta "${error.folder}" sumiu do Google Drive. Se ela estiver na lixeira do Drive, restaure-a.`,
    )
  }
  if (error instanceof UnsupportedLibraryFormat) {
    return new SyncError(
      'formato',
      'A biblioteca no Drive foi gravada por uma versão mais nova do app. Atualize o app neste aparelho.',
    )
  }
  if (isDriveApiError(error)) {
    if (error.reason === 'storageQuotaExceeded') return new SyncError('cheio', 'O seu Google Drive está cheio.')
    if (isTransient(error))
      return new SyncError('offline', 'O Google Drive não respondeu. Tente de novo daqui a pouco.')
    return new SyncError('erro', error.message)
  }
  // Sem rede, o expo/fetch falha com um TypeError ou um erro que fala em "network".
  if (error instanceof TypeError || /network/i.test(String(error))) {
    return new SyncError('offline', 'Sem conexão com a internet.')
  }
  return new SyncError('erro', String(error))
}

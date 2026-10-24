import { getBook, saveDownloadedFile, type Book } from '@/lib/db/books'
import type { Db } from '@/lib/db/db'
import type { DriveApi } from '@/lib/drive/api'

export class BookNotHereError extends Error {
  constructor() {
    super('O arquivo do livro não está neste aparelho')
    this.name = 'BookNotHereError'
  }
}

export interface BookFileDeps {
  db: Db
  api: Pick<DriveApi, 'downloadBytes'>
  // Troca atômica (files.replaceBytes): um download pela metade não substitui o livro.
  replaceFile(path: string, bytes: Uint8Array): Promise<void>
  // A trava da biblioteca (library-lock): gravar o arquivo baixado não pode
  // cruzar com excluir ou editar o livro.
  lock<T>(fn: () => Promise<T>): Promise<T>
}

// O arquivo falta (só na nuvem) ou é de antes de uma edição feita em outro aparelho.
export function needsDownload(book: Pick<Book, 'blobUpdatedAt' | 'fileUpdatedAt'>): boolean {
  return book.blobUpdatedAt === null || book.blobUpdatedAt < book.fileUpdatedAt
}

// Baixa e guarda; lança quando não dá (sem rede, Drive desconectado, arquivo sumiu).
// Um livro excluído durante o download não ganha o arquivo de volta.
export async function downloadBook(deps: BookFileDeps, book: Book): Promise<void> {
  if (!book.driveFileId) throw new BookNotHereError()
  const bytes = await deps.api.downloadBytes(book.driveFileId)
  await deps.lock(async () => {
    if (!(await getBook(deps.db, book.id))) return
    await deps.replaceFile(book.filePath, bytes)
    await saveDownloadedFile(deps.db, book.id, book.fileUpdatedAt, bytes.length)
  })
}

// Antes de abrir: baixa se precisar. Sem conexão, uma versão antiga daqui
// ainda abre (uma edição só muda título, autor e capa). `download` permite
// usar o mesmo download em andamento do botão de baixar (download-store).
export async function ensureBookFile(
  deps: BookFileDeps,
  book: Book,
  download: (book: Book) => Promise<void> = (target) => downloadBook(deps, target),
): Promise<void> {
  if (!needsDownload(book)) return
  try {
    await download(book)
  } catch (error) {
    if (book.blobUpdatedAt !== null) return
    if (error instanceof BookNotHereError) throw error
    console.warn('Não foi possível baixar o livro', error)
    throw new BookNotHereError()
  }
}

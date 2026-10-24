import { deleteBook, getBook, hasLocalFile, insertBook, saveDownloadedFile, type Book } from './db/books'
import { bookPath, coverPath } from './book-paths'
import type { Db } from './db/db'
import { bookIdFor } from './epub/book-id'
import { parseEpub } from './epub/parse'
import { prepareEpub } from './epub/prepare'

export interface PickedFile {
  uri: string
  name: string
}

export interface ImportDeps {
  db: Db
  readBytes(uri: string): Promise<Uint8Array>
  storeBook(id: string, bytes: Uint8Array): Promise<void>
  convertPdf?(uri: string, name: string): Promise<Uint8Array>
  storeCover(id: string, bytes: Uint8Array, extension: string): Promise<void>
  deleteFiles(paths: (string | null)[]): void
  discardPicked(uri: string): void
  now(): number
}

export interface ImportSummary {
  imported: string[]
  duplicates: string[]
  invalid: { name: string; reason: string }[]
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]

function isPdf(bytes: Uint8Array): boolean {
  return PDF_SIGNATURE.every((byte, i) => bytes[i] === byte)
}

export async function importBooks(deps: ImportDeps, files: PickedFile[]): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: [], duplicates: [], invalid: [] }
  for (const file of files) {
    try {
      let bytes = await deps.readBytes(file.uri)
      if (isPdf(bytes)) {
        if (!deps.convertPdf) throw new Error('Não foi possível converter o PDF')
        bytes = await deps.convertPdf(file.uri, file.name)
      }
      const parsed = await parseEpub(bytes, file.name)
      const id = bookIdFor(bytes)
      const existing = await getBook(deps.db, id)
      if (existing) {
        // Só no Drive e nunca editado: este arquivo é o mesmo livro, e fica aqui
        // no lugar de um download.
        if (!hasLocalFile(existing) && existing.fileUpdatedAt === existing.addedAt) {
          const prepared = (await prepareEpub(bytes)).bytes
          await deps.storeBook(id, prepared)
          await saveDownloadedFile(deps.db, id, existing.fileUpdatedAt, prepared.length)
          summary.imported.push(parsed.title)
        } else {
          summary.duplicates.push(parsed.title)
        }
        continue
      }
      const stored: string[] = []
      try {
        // O caminho entra na lista antes da cópia: se ela falhar no meio, o arquivo parcial também é apagado.
        const filePath = bookPath(id)
        stored.push(filePath)
        const prepared = (await prepareEpub(bytes)).bytes
        await deps.storeBook(id, prepared)
        let coverFile: string | null = null
        if (parsed.cover) {
          coverFile = coverPath(id, parsed.cover.extension)
          stored.push(coverFile)
          await deps.storeCover(id, parsed.cover.bytes, parsed.cover.extension)
        }
        await insertBook(deps.db, {
          id,
          title: parsed.title,
          author: parsed.author,
          filePath,
          coverPath: coverFile,
          size: prepared.length,
          addedAt: deps.now(),
        })
      } catch (error) {
        deps.deleteFiles(stored)
        throw error
      }
      summary.imported.push(parsed.title)
    } catch (error) {
      summary.invalid.push({ name: file.name, reason: error instanceof Error ? error.message : String(error) })
    } finally {
      deps.discardPicked(file.uri)
    }
  }
  return summary
}

export async function removeBook(deps: Pick<ImportDeps, 'db' | 'deleteFiles' | 'now'>, book: Book): Promise<void> {
  await deleteBook(deps.db, book.id, deps.now())
  deps.deleteFiles([book.filePath, book.coverPath])
}

export function formatSummary(summary: ImportSummary): string {
  const lines: string[] = []
  if (summary.imported.length) {
    lines.push(`${summary.imported.length} ${summary.imported.length === 1 ? 'importado' : 'importados'}.`)
  }
  if (summary.duplicates.length) {
    const n = summary.duplicates.length
    lines.push(`${n} ${n === 1 ? 'já estava' : 'já estavam'} na biblioteca: ${summary.duplicates.join(', ')}`)
  }
  for (const item of summary.invalid) lines.push(`Não importado: ${item.name} (${item.reason})`)
  return lines.join('\n') || 'Nada importado.'
}

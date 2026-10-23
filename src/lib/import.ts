import { deleteBook, getBook, insertBook, type Book } from './db/books'
import { bookPath, coverPath } from './book-paths'
import type { Db } from './db/db'
import { bookIdFor } from './epub/book-id'
import { parseEpub } from './epub/parse'

export interface PickedFile {
  uri: string
  name: string
}

export interface ImportDeps {
  db: Db
  readBytes(uri: string): Promise<Uint8Array>
  storeBook(id: string, sourceUri: string): Promise<void>
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

export async function importBooks(deps: ImportDeps, files: PickedFile[]): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: [], duplicates: [], invalid: [] }
  for (const file of files) {
    try {
      const bytes = await deps.readBytes(file.uri)
      const parsed = await parseEpub(bytes, file.name)
      const id = bookIdFor(bytes)
      if (await getBook(deps.db, id)) {
        summary.duplicates.push(parsed.title)
        continue
      }
      const stored: string[] = []
      try {
        // O caminho entra na lista antes da cópia: se ela falhar no meio, o arquivo parcial também é apagado.
        const filePath = bookPath(id)
        stored.push(filePath)
        await deps.storeBook(id, file.uri)
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
          size: bytes.length,
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

export async function removeBook(deps: Pick<ImportDeps, 'db' | 'deleteFiles'>, book: Book): Promise<void> {
  await deleteBook(deps.db, book.id)
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

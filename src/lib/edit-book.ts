import { coverPath as coverPathFor } from './book-paths'
import { updateBookInfo, type Book } from './db/books'
import type { Db } from './db/db'
import { editBookInfo, type BookInfoEdits } from './epub/edit'
import { parseEpub } from './epub/parse'

export interface EditDeps {
  db: Db
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, bytes: Uint8Array): Promise<void>
  // Troca o arquivo inteiro de uma vez: nunca deixa um livro pela metade no lugar do original.
  replaceFile(path: string, bytes: Uint8Array): Promise<void>
  deleteFiles(paths: (string | null)[]): void
}

// O ID do livro não muda: ele liga progresso e grifos, e o leitor web faz igual.
// Ordem: capa, livro, banco. Se algo falha, o livro e a capa voltam ao que eram
// e o banco não muda.
export async function editBook(deps: EditDeps, book: Book, edits: BookInfoEdits): Promise<void> {
  const original = await deps.readFile(book.filePath)
  const edited = await editBookInfo(original, edits)
  const parsed = await parseEpub(edited, `${book.title}.epub`)
  const coverPath = parsed.cover ? coverPathFor(book.id, parsed.cover.extension) : book.coverPath
  const sameCoverPath = coverPath === book.coverPath
  const oldCover = parsed.cover && sameCoverPath && book.coverPath ? await deps.readFile(book.coverPath) : null

  const undoCover = async () => {
    if (!parsed.cover) return
    if (!sameCoverPath) deps.deleteFiles([coverPath])
    else if (oldCover) await deps.writeFile(coverPath!, oldCover).catch(logRestore)
  }

  if (parsed.cover) {
    try {
      await deps.writeFile(coverPath!, parsed.cover.bytes)
    } catch (error) {
      await undoCover()
      throw error
    }
  }
  try {
    await deps.replaceFile(book.filePath, edited)
  } catch (error) {
    await undoCover()
    throw error
  }
  try {
    await updateBookInfo(deps.db, book.id, { title: parsed.title, author: parsed.author, coverPath })
  } catch (error) {
    await deps.replaceFile(book.filePath, original).catch(logRestore)
    await undoCover()
    throw error
  }
  if (!sameCoverPath) deps.deleteFiles([book.coverPath])
}

function logRestore(error: unknown) {
  console.error('Não foi possível restaurar o arquivo original.', error)
}

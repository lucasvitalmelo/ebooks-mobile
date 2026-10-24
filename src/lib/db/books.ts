import type { Db } from './db'
import { bookDeletionKey, recordDeletion } from './deletions'

export interface Book {
  id: string
  title: string
  author: string
  // Sempre books/<id>.epub; num livro que só está no Drive o arquivo não existe.
  filePath: string
  coverPath: string | null
  size: number
  locations: string | null
  addedAt: number
  lastOpenedAt: number | null
  fontScale: number | null
  prepared: number
  // Carimbos da sincronização, os mesmos do leitor web: a última mudança no
  // registro, a última mudança no arquivo, e de quando é o arquivo que está
  // aqui (NULL: só está no Drive).
  updatedAt: number
  fileUpdatedAt: number
  blobUpdatedAt: number | null
  pendingUpload: number
  driveFileId: string | null
  driveCoverId: string | null
}

export type NewBook = Pick<Book, 'id' | 'title' | 'author' | 'filePath' | 'coverPath' | 'size' | 'addedAt'>

export const hasLocalFile = (book: Pick<Book, 'blobUpdatedAt'>) => book.blobUpdatedAt !== null

export function listBooks(db: Db): Promise<Book[]> {
  return db.getAll<Book>('SELECT * FROM books ORDER BY lastOpenedAt IS NULL, lastOpenedAt DESC, addedAt DESC')
}

export function getBook(db: Db, id: string): Promise<Book | null> {
  return db.getFirst<Book>('SELECT * FROM books WHERE id = ?', [id])
}

export async function insertBook(db: Db, book: NewBook): Promise<void> {
  await db.run(
    `INSERT INTO books (id, title, author, filePath, coverPath, size, addedAt, prepared,
       updatedAt, fileUpdatedAt, blobUpdatedAt, pendingUpload)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)`,
    [
      book.id,
      book.title,
      book.author,
      book.filePath,
      book.coverPath,
      book.size,
      book.addedAt,
      book.addedAt,
      book.addedAt,
      book.addedAt,
    ],
  )
}

export function listUnprepared(db: Db): Promise<Book[]> {
  return db.getAll<Book>('SELECT * FROM books WHERE prepared = 0 ORDER BY addedAt')
}

export async function markPrepared(db: Db, id: string): Promise<void> {
  await db.run('UPDATE books SET prepared = 1 WHERE id = ?', [id])
}

// O arquivo daqui mudou sem ser uma edição (a limpeza do CSS): sobe de novo
// para o Drive, sem carimbar o registro, para não vencer edições de outro aparelho.
export async function markFileForUpload(db: Db, id: string): Promise<void> {
  await db.run('UPDATE books SET pendingUpload = 1 WHERE id = ?', [id])
}

export async function setFontScale(db: Db, id: string, value: number): Promise<void> {
  await db.run('UPDATE books SET fontScale = ? WHERE id = ?', [value, id])
}

export async function markOpened(db: Db, id: string, at: number): Promise<void> {
  await db.run('UPDATE books SET lastOpenedAt = ? WHERE id = ?', [at, id])
}

export async function saveLocations(db: Db, id: string, locations: string): Promise<void> {
  await db.run('UPDATE books SET locations = ? WHERE id = ?', [locations, id])
}

export async function deleteBook(db: Db, id: string, at: number): Promise<void> {
  await db.run('DELETE FROM books WHERE id = ?', [id])
  // A exclusão do livro cobre os grifos dele também.
  await recordDeletion(db, bookDeletionKey(id), at)
}

export type BookWithProgress = Book & { percent: number | null }

export function listBooksWithProgress(db: Db): Promise<BookWithProgress[]> {
  return db.getAll<BookWithProgress>(
    `SELECT b.*, p.percent AS percent FROM books b LEFT JOIN progress p ON p.bookId = b.id
     ORDER BY b.lastOpenedAt IS NULL, b.lastOpenedAt DESC, b.addedAt DESC`,
  )
}

// Editar reescreve o arquivo inteiro (título, autor e capa vão dentro do EPUB).
export async function updateBookInfo(
  db: Db,
  id: string,
  info: { title: string; author: string; coverPath: string | null },
  at: number,
): Promise<void> {
  await db.run(
    `UPDATE books SET title = ?, author = ?, coverPath = ?,
       updatedAt = ?, fileUpdatedAt = ?, blobUpdatedAt = ?, pendingUpload = 1 WHERE id = ?`,
    [info.title, info.author, info.coverPath, at, at, at, id],
  )
}

// Libera o espaço do arquivo e mantém o resto (registro, capa, progresso e
// grifos). Só para livro que já está no Drive sem nada pendente: senão o
// arquivo daqui é a única cópia. Quem chama apaga o arquivo depois.
export async function removeLocalFile(db: Db, id: string): Promise<void> {
  const book = await getBook(db, id)
  if (!book?.driveFileId || book.pendingUpload !== 0) {
    throw new Error('O livro não está no Google Drive: o arquivo deste aparelho é a única cópia')
  }
  await db.run('UPDATE books SET blobUpdatedAt = NULL WHERE id = ?', [id])
}

// O arquivo baixado agora é a versão que o registro descreve.
export async function saveDownloadedFile(db: Db, id: string, fileUpdatedAt: number, size: number): Promise<void> {
  await db.run('UPDATE books SET blobUpdatedAt = ?, size = ? WHERE id = ?', [fileUpdatedAt, size, id])
}

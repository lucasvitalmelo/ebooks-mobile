import type { Db } from './db'

export interface Book {
  id: string
  title: string
  author: string
  filePath: string
  coverPath: string | null
  size: number
  locations: string | null
  addedAt: number
  lastOpenedAt: number | null
}

export type NewBook = Omit<Book, 'locations' | 'lastOpenedAt'>

export function listBooks(db: Db): Promise<Book[]> {
  return db.getAll<Book>('SELECT * FROM books ORDER BY lastOpenedAt IS NULL, lastOpenedAt DESC, addedAt DESC')
}

export function getBook(db: Db, id: string): Promise<Book | null> {
  return db.getFirst<Book>('SELECT * FROM books WHERE id = ?', [id])
}

export async function insertBook(db: Db, book: NewBook): Promise<void> {
  await db.run(
    'INSERT INTO books (id, title, author, filePath, coverPath, size, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [book.id, book.title, book.author, book.filePath, book.coverPath, book.size, book.addedAt],
  )
}

export async function markOpened(db: Db, id: string, at: number): Promise<void> {
  await db.run('UPDATE books SET lastOpenedAt = ? WHERE id = ?', [at, id])
}

export async function saveLocations(db: Db, id: string, locations: string): Promise<void> {
  await db.run('UPDATE books SET locations = ? WHERE id = ?', [locations, id])
}

export async function deleteBook(db: Db, id: string): Promise<void> {
  await db.run('DELETE FROM books WHERE id = ?', [id])
}

export type BookWithProgress = Book & { percent: number | null }

export function listBooksWithProgress(db: Db): Promise<BookWithProgress[]> {
  return db.getAll<BookWithProgress>(
    `SELECT b.*, p.percent AS percent FROM books b LEFT JOIN progress p ON p.bookId = b.id
     ORDER BY b.lastOpenedAt IS NULL, b.lastOpenedAt DESC, b.addedAt DESC`,
  )
}

export async function updateBookInfo(
  db: Db,
  id: string,
  info: { title: string; author: string; coverPath: string | null },
): Promise<void> {
  await db.run('UPDATE books SET title = ?, author = ?, coverPath = ? WHERE id = ?', [
    info.title,
    info.author,
    info.coverPath,
    id,
  ])
}

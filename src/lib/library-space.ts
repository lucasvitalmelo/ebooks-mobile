import type { Book } from './db/books'

type SpaceBook = Pick<Book, 'size' | 'blobUpdatedAt' | 'driveFileId' | 'pendingUpload'>

export function spaceUsed(books: SpaceBook[]): { bytes: number; books: number } {
  const here = books.filter((book) => book.blobUpdatedAt !== null)
  return { bytes: here.reduce((sum, book) => sum + book.size, 0), books: here.length }
}

// A mesma regra do "Remover deste aparelho": o arquivo daqui não é a única cópia.
export function canFreeSpace(book: SpaceBook): boolean {
  return book.blobUpdatedAt !== null && book.driveFileId !== null && book.pendingUpload === 0
}

const MB = 1024 * 1024

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * MB) return `${(bytes / (1024 * MB)).toFixed(1).replace('.', ',')} GB`
  const mb = bytes / MB
  return `${mb >= 10 || mb === 0 ? Math.round(mb) : mb.toFixed(1).replace('.', ',')} MB`
}

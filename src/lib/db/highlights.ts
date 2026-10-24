import { byBookOrder } from '@/reader/cfi-order'
import type { Db } from './db'

export interface Highlight {
  id: string
  bookId: string
  cfiRange: string
  text: string
  createdAt: number
  updatedAt: number
  note: string | null
}

export async function listHighlights(db: Db, bookId: string): Promise<Highlight[]> {
  return byBookOrder(await db.getAll<Highlight>('SELECT * FROM highlights WHERE bookId = ?', [bookId]))
}

export async function addHighlight(db: Db, highlight: Omit<Highlight, 'updatedAt' | 'note'>): Promise<void> {
  const { id, bookId, cfiRange, text, createdAt } = highlight
  await db.run('INSERT INTO highlights (id, bookId, cfiRange, text, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    bookId,
    cfiRange,
    text,
    createdAt,
    createdAt,
  ])
}

export async function deleteHighlight(db: Db, id: string): Promise<void> {
  await db.run('DELETE FROM highlights WHERE id = ?', [id])
}

export async function setHighlightNote(db: Db, id: string, note: string, at: number): Promise<void> {
  const trimmed = note.trim()
  await db.run('UPDATE highlights SET note = ?, updatedAt = ? WHERE id = ?', [trimmed || null, at, id])
}

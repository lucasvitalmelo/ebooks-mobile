import { byBookOrder } from '@/reader/cfi-order'
import type { Db } from './db'
import { highlightDeletionKey, recordDeletion } from './deletions'

// A cor fixa do leitor web: o arquivo do Drive exige uma.
export const HIGHLIGHT_COLOR = '#fac73c'

export interface Highlight {
  id: string
  bookId: string
  cfiRange: string
  text: string
  color: string
  createdAt: number
  updatedAt: number
  note: string | null
}

export async function listHighlights(db: Db, bookId: string): Promise<Highlight[]> {
  return byBookOrder(await db.getAll<Highlight>('SELECT * FROM highlights WHERE bookId = ?', [bookId]))
}

export async function addHighlight(
  db: Db,
  highlight: Pick<Highlight, 'id' | 'bookId' | 'cfiRange' | 'text' | 'createdAt'>,
): Promise<void> {
  const { id, bookId, cfiRange, text, createdAt } = highlight
  await db.run(
    'INSERT INTO highlights (id, bookId, cfiRange, text, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, bookId, cfiRange, text, HIGHLIGHT_COLOR, createdAt, createdAt],
  )
}

export async function deleteHighlight(db: Db, id: string, at: number): Promise<void> {
  await db.run('DELETE FROM highlights WHERE id = ?', [id])
  await recordDeletion(db, highlightDeletionKey(id), at)
}

export async function setHighlightNote(db: Db, id: string, note: string, at: number): Promise<void> {
  const trimmed = note.trim()
  await db.run('UPDATE highlights SET note = ?, updatedAt = ? WHERE id = ?', [trimmed || null, at, id])
}

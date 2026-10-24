import type { Db } from './db'

export interface Progress {
  bookId: string
  cfi: string | null
  percent: number | null
  updatedAt: number
}

export function getProgress(db: Db, bookId: string): Promise<Progress | null> {
  return db.getFirst<Progress>('SELECT * FROM progress WHERE bookId = ?', [bookId])
}

export async function saveProgress(
  db: Db,
  progress: Omit<Progress, 'updatedAt' | 'cfi'> & { cfi: string },
  at: number,
): Promise<void> {
  await db.run(
    `INSERT INTO progress (bookId, cfi, percent, updatedAt) VALUES (?, ?, ?, ?)
     ON CONFLICT(bookId) DO UPDATE SET cfi = excluded.cfi, percent = excluded.percent, updatedAt = excluded.updatedAt`,
    [progress.bookId, progress.cfi, progress.percent, at],
  )
}

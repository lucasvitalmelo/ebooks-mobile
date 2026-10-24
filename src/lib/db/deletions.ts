import type { Db } from './db'
import { getSetting, setSetting } from './settings'

export const bookDeletionKey = (id: string) => `book:${id}`
export const highlightDeletionKey = (id: string) => `highlight:${id}`

// Exclusões só são registradas depois que este aparelho conectou ao Drive: um
// livro removido antes disso não pode, mais tarde, apagar o mesmo livro que
// outro aparelho pôs no Drive (a mesma regra do leitor web).
export async function isDriveEnabled(db: Db): Promise<boolean> {
  return (await getSetting(db, 'driveEnabled')) === 'true'
}

export async function setDriveEnabled(db: Db, enabled: boolean): Promise<void> {
  await setSetting(db, 'driveEnabled', String(enabled))
}

export async function recordDeletion(db: Db, key: string, at: number): Promise<void> {
  if (!(await isDriveEnabled(db))) return
  await db.run(
    'INSERT INTO deletions (key, deletedAt) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET deletedAt = MAX(deletedAt, excluded.deletedAt)',
    [key, at],
  )
}

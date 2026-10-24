import { bookPath } from '@/lib/book-paths'
import type { LocalChanges, LocalLibrary } from '@/lib/sync/merge'
import { getBook, type Book } from './books'
import type { Db } from './db'
import type { Highlight } from './highlights'
import type { Progress } from './progress'
import { getSetting, setSetting } from './settings'

// O lado do banco da sincronização. Nada aqui passa pelas funções de edição
// de books.ts: o que vem de outro aparelho não pode carimbar o livro como
// mudado aqui.

export interface DriveFolders {
  root: string
  data: string
  covers: string
}

export async function getDriveFolders(db: Db): Promise<DriveFolders | null> {
  const value = await getSetting(db, 'driveFolders')
  return value ? (JSON.parse(value) as DriveFolders) : null
}

export async function setDriveFolders(db: Db, folders: DriveFolders): Promise<void> {
  await setSetting(db, 'driveFolders', JSON.stringify(folders))
}

// Devolve quantas havia.
export async function clearDeletions(db: Db): Promise<number> {
  const result = await db.run('DELETE FROM deletions')
  return result.changes
}

export async function readLocalLibrary(db: Db): Promise<LocalLibrary> {
  const books = await db.getAll<Book>('SELECT * FROM books')
  const progress = await db.getAll<Progress>('SELECT * FROM progress')
  const highlights = await db.getAll<Highlight>('SELECT * FROM highlights')
  const deletions = await db.getAll<{ key: string; deletedAt: number }>('SELECT * FROM deletions')
  return {
    books: books.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      addedAt: book.addedAt,
      updatedAt: book.updatedAt,
      fileUpdatedAt: book.fileUpdatedAt,
      ...(book.fontScale !== null ? { fontScale: book.fontScale } : {}),
      driveFileId: book.driveFileId,
      driveCoverId: book.driveCoverId,
      pendingUpload: book.pendingUpload === 1,
    })),
    // O web guarda a porcentagem inteira de 0 a 100.
    progress: progress.map((row) => ({
      bookId: row.bookId,
      cfi: row.cfi,
      percentage: Math.round((row.percent ?? 0) * 100),
      lastReadAt: row.updatedAt,
    })),
    highlights: highlights.map((row) => ({
      id: row.id,
      bookId: row.bookId,
      cfiRange: row.cfiRange,
      text: row.text,
      color: row.color,
      ...(row.note !== null ? { note: row.note } : {}),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    deletions,
  }
}

// Quantos registros a sincronização mudou aqui, por tipo (livros que chegaram
// ou saíram são anunciados), e os arquivos que ficaram sem dono: o livro e a
// capa de um livro removido, a capa antiga de um livro com capa nova.
export interface AppliedChanges {
  booksAdded: number
  booksRemoved: number
  other: number
  filesToDelete: string[]
}

// Cada registro só é gravado se ainda for o que a junção viu; um que mudou no
// meio (o leitor salvou a posição, um grifo foi editado) fica para a próxima.
// A conferência do carimbo vai no próprio SQL: o leitor grava sem a trava da
// biblioteca, e uma leitura antes da gravação deixaria uma janela entre as duas.
export async function applyRemoteChanges(db: Db, changes: LocalChanges): Promise<AppliedChanges> {
  const applied: AppliedChanges = { booksAdded: 0, booksRemoved: 0, other: 0, filesToDelete: [] }

  for (const { id, book, expected } of changes.books) {
    if (expected === null) {
      const result = await db.run(
        `INSERT INTO books (id, title, author, filePath, coverPath, size, addedAt, prepared, fontScale,
           updatedAt, fileUpdatedAt, blobUpdatedAt, pendingUpload, driveFileId, driveCoverId)
         VALUES (?, ?, ?, ?, NULL, 0, ?, 1, ?, ?, ?, NULL, 0, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        [
          id,
          book.title,
          book.author,
          bookPath(id),
          book.addedAt,
          book.fontScale ?? null,
          book.updatedAt,
          book.fileUpdatedAt,
          book.fileId,
          book.coverId,
        ],
      )
      applied.booksAdded += result.changes
      continue
    }
    const current = await getBook(db, id)
    if (!current || current.updatedAt !== expected) continue
    // Nenhum dos lados editou o livro: o arquivo daqui já é o conteúdo do
    // registro vencedor. Senão, um envio pendente perdeu para a edição do outro
    // lado, e o arquivo é baixado de novo para bater com o registro.
    const sameContent = current.fileUpdatedAt === current.addedAt && book.fileUpdatedAt === book.addedAt
    let blobUpdatedAt = current.blobUpdatedAt
    if (current.blobUpdatedAt !== null) {
      if (sameContent) blobUpdatedAt = book.fileUpdatedAt
      else if (current.pendingUpload === 1) blobUpdatedAt = 0
    }
    // Um registro mais novo pode trazer capa nova: ela é baixada de novo.
    const newCover = book.coverId !== null && book.updatedAt > expected
    const result = await db.run(
      `UPDATE books SET title = ?, author = ?, addedAt = ?, updatedAt = ?, fileUpdatedAt = ?, driveFileId = ?,
         driveCoverId = ?, fontScale = ?, pendingUpload = 0, blobUpdatedAt = ?, coverPath = ?
       WHERE id = ? AND updatedAt = ?`,
      [
        book.title,
        book.author,
        book.addedAt,
        book.updatedAt,
        book.fileUpdatedAt,
        book.fileId,
        book.coverId,
        book.fontScale ?? current.fontScale,
        blobUpdatedAt,
        newCover ? null : current.coverPath,
        id,
        expected,
      ],
    )
    if (result.changes === 0) continue
    if (newCover && current.coverPath) applied.filesToDelete.push(current.coverPath)
    applied.other++
  }

  for (const { id, expected } of changes.removedBooks) {
    // Lido antes só pelos caminhos dos arquivos; quem decide é o DELETE.
    const current = await getBook(db, id)
    if (!current) continue
    // Progresso e grifos saem junto pelo ON DELETE CASCADE.
    const result = await db.run('DELETE FROM books WHERE id = ? AND updatedAt = ?', [id, expected])
    if (result.changes === 0) continue
    applied.filesToDelete.push(current.filePath, ...(current.coverPath ? [current.coverPath] : []))
    applied.booksRemoved++
  }

  for (const { bookId, progress, expected } of changes.progress) {
    if (!(await getBook(db, bookId))) continue
    const result =
      expected === null
        ? await db.run(
            `INSERT INTO progress (bookId, cfi, percent, updatedAt) VALUES (?, ?, ?, ?)
             ON CONFLICT(bookId) DO NOTHING`,
            [bookId, progress.cfi, progress.percentage / 100, progress.lastReadAt],
          )
        : // UPDATE, não upsert: uma linha apagada aqui no meio não volta.
          await db.run('UPDATE progress SET cfi = ?, percent = ?, updatedAt = ? WHERE bookId = ? AND updatedAt = ?', [
            progress.cfi,
            progress.percentage / 100,
            progress.lastReadAt,
            bookId,
            expected,
          ])
    applied.other += result.changes
  }

  for (const { id, highlight, expected } of changes.highlights) {
    if (!(await getBook(db, highlight.bookId))) continue
    const fields = [
      highlight.bookId,
      highlight.cfiRange,
      highlight.text,
      highlight.color,
      highlight.note ?? null,
      highlight.createdAt,
      highlight.updatedAt,
    ]
    const result =
      expected === null
        ? await db.run(
            `INSERT INTO highlights (id, bookId, cfiRange, text, color, note, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
            [id, ...fields],
          )
        : // UPDATE, não upsert: um grifo apagado aqui no meio não volta.
          await db.run(
            `UPDATE highlights SET bookId = ?, cfiRange = ?, text = ?, color = ?, note = ?, createdAt = ?, updatedAt = ?
             WHERE id = ? AND updatedAt = ?`,
            [...fields, id, expected],
          )
    applied.other += result.changes
  }

  for (const { id, expected } of changes.removedHighlights) {
    const result = await db.run('DELETE FROM highlights WHERE id = ? AND updatedAt = ?', [id, expected])
    applied.other += result.changes
  }

  for (const deletion of changes.deletions) {
    await db.run(
      'INSERT INTO deletions (key, deletedAt) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET deletedAt = MAX(deletedAt, excluded.deletedAt)',
      [deletion.key, deletion.deletedAt],
    )
  }
  return applied
}

export function listBooksToUpload(db: Db): Promise<Book[]> {
  return db.getAll<Book>('SELECT * FROM books WHERE pendingUpload = 1 AND blobUpdatedAt IS NOT NULL ORDER BY addedAt')
}

// Os IDs do Drive ficam de qualquer jeito, para o próximo envio atualizar os
// mesmos arquivos em vez de criar cópias; o livro só deixa de estar pendente se
// não mudou enquanto subia.
export async function markBookUploaded(
  db: Db,
  id: string,
  refs: { driveFileId: string; driveCoverId: string | null },
  expected: { updatedAt: number; fileUpdatedAt: number },
): Promise<boolean> {
  const current = await getBook(db, id)
  if (!current) return false
  const unchanged = current.updatedAt === expected.updatedAt && current.fileUpdatedAt === expected.fileUpdatedAt
  await db.run(
    `UPDATE books SET driveFileId = ?, driveCoverId = ?${unchanged ? ', pendingUpload = 0' : ''} WHERE id = ?`,
    [refs.driveFileId, refs.driveCoverId, id],
  )
  return unchanged
}

export function listBooksMissingCover(db: Db): Promise<{ id: string; driveCoverId: string }[]> {
  return db.getAll('SELECT id, driveCoverId FROM books WHERE driveCoverId IS NOT NULL AND coverPath IS NULL')
}

// Só se o livro ainda espera aquela capa: uma edição ou outra capa que chegou
// durante o download vence. false: quem chamou apaga o arquivo baixado.
export async function saveDownloadedCover(db: Db, id: string, path: string, driveCoverId: string): Promise<boolean> {
  const result = await db.run(
    'UPDATE books SET coverPath = ? WHERE id = ? AND coverPath IS NULL AND driveCoverId = ?',
    [path, id, driveCoverId],
  )
  return result.changes > 0
}

export async function clearDownloadedCover(db: Db, id: string, path: string): Promise<void> {
  await db.run('UPDATE books SET coverPath = NULL WHERE id = ? AND coverPath = ?', [id, path])
}

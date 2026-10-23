import { insertBook } from './books'
import { migrate } from './migrations'
import { getProgress, saveProgress } from './progress'
import { openTestDb } from './testing/node-db'

test('grava, sobrescreve e lê o progresso', async () => {
  const db = openTestDb()
  await migrate(db)
  await insertBook(db, {
    id: 'a',
    title: 't',
    author: 'a',
    filePath: 'books/a.epub',
    coverPath: null,
    size: 1,
    addedAt: 0,
  })
  expect(await getProgress(db, 'a')).toBeNull()
  await saveProgress(db, { bookId: 'a', cfi: 'epubcfi(/6/2)', percent: null }, 1)
  await saveProgress(db, { bookId: 'a', cfi: 'epubcfi(/6/4)', percent: 0.25 }, 2)
  expect(await getProgress(db, 'a')).toEqual({ bookId: 'a', cfi: 'epubcfi(/6/4)', percent: 0.25, updatedAt: 2 })
})

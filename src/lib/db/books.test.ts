import {
  deleteBook,
  getBook,
  insertBook,
  listBooks,
  listBooksWithProgress,
  markOpened,
  saveLocations,
  updateBookInfo,
  type NewBook,
} from './books'
import { migrate } from './migrations'
import { saveProgress } from './progress'
import { openTestDb } from './testing/node-db'

const book = (id: string, addedAt: number): NewBook => ({
  id,
  title: `Livro ${id}`,
  author: 'Autora',
  filePath: `books/${id}.epub`,
  coverPath: null,
  size: 10,
  addedAt,
})

async function setup() {
  const db = openTestDb()
  await migrate(db)
  return db
}

test('insere e lê de volta', async () => {
  const db = await setup()
  await insertBook(db, book('a', 1))
  expect(await getBook(db, 'a')).toEqual({ ...book('a', 1), locations: null, lastOpenedAt: null })
  expect(await getBook(db, 'x')).toBeNull()
})

test('lista os abertos por último primeiro, depois os recém-adicionados', async () => {
  const db = await setup()
  await insertBook(db, book('a', 1))
  await insertBook(db, book('b', 2))
  await insertBook(db, book('c', 3))
  await insertBook(db, book('d', 4))
  await markOpened(db, 'a', 10)
  await markOpened(db, 'b', 20)
  expect((await listBooks(db)).map((b) => b.id)).toEqual(['b', 'a', 'd', 'c'])
})

test('guarda as locations e apaga', async () => {
  const db = await setup()
  await insertBook(db, book('a', 1))
  await saveLocations(db, 'a', '["epubcfi(/6/2)"]')
  expect((await getBook(db, 'a'))?.locations).toBe('["epubcfi(/6/2)"]')
  await deleteBook(db, 'a')
  expect(await listBooks(db)).toEqual([])
})

test('lista com o progresso de cada livro', async () => {
  const db = await setup()
  await insertBook(db, book('a', 1))
  await insertBook(db, book('b', 2))
  await saveProgress(db, { bookId: 'a', cfi: 'epubcfi(/6/2)', percent: 0.42 }, 5)
  await markOpened(db, 'a', 10)
  const rows = await listBooksWithProgress(db)
  expect(rows.map((r) => [r.id, r.percent])).toEqual([
    ['a', 0.42],
    ['b', null],
  ])
})

test('atualiza título, autor e capa sem mudar o resto', async () => {
  const db = await setup()
  await insertBook(db, book('a', 1))
  await updateBookInfo(db, 'a', { title: 'Novo', author: 'Ana & Bia', coverPath: 'covers/a.jpg' })
  expect(await getBook(db, 'a')).toMatchObject({
    id: 'a',
    title: 'Novo',
    author: 'Ana & Bia',
    coverPath: 'covers/a.jpg',
    addedAt: 1,
  })
})

import { insertBook } from './books'
import { setDriveEnabled } from './deletions'
import { addHighlight, deleteHighlight, HIGHLIGHT_COLOR, listHighlights, setHighlightNote } from './highlights'
import { migrate } from './migrations'
import { openTestDb } from './testing/node-db'

async function setup() {
  const db = openTestDb()
  await migrate(db)
  await insertBook(db, {
    id: 'b',
    title: 't',
    author: 'a',
    filePath: 'books/b.epub',
    coverPath: null,
    size: 1,
    addedAt: 0,
  })
  return db
}

test('grava, lista na ordem do livro e apaga', async () => {
  const db = await setup()
  await addHighlight(db, {
    id: 'h2',
    bookId: 'b',
    cfiRange: 'epubcfi(/6/4!/4,/1:0,/1:5)',
    text: 'depois',
    createdAt: 1,
  })
  await addHighlight(db, { id: 'h1', bookId: 'b', cfiRange: 'epubcfi(/6/2!/4,/1:0,/1:5)', text: 'antes', createdAt: 2 })
  const rows = await listHighlights(db, 'b')
  expect(rows.map((h) => h.id)).toEqual(['h1', 'h2'])
  expect(rows[0]).toEqual({
    id: 'h1',
    bookId: 'b',
    cfiRange: 'epubcfi(/6/2!/4,/1:0,/1:5)',
    text: 'antes',
    color: '#fac73c',
    createdAt: 2,
    updatedAt: 2,
    note: null,
  })
  await deleteHighlight(db, 'h1', 3)
  expect((await listHighlights(db, 'b')).map((h) => h.id)).toEqual(['h2'])
})

test('lista só os grifos do livro pedido', async () => {
  const db = await setup()
  await insertBook(db, {
    id: 'c',
    title: 't',
    author: 'a',
    filePath: 'books/c.epub',
    coverPath: null,
    size: 1,
    addedAt: 0,
  })
  await addHighlight(db, { id: 'h', bookId: 'c', cfiRange: 'epubcfi(/6/2)', text: 'x', createdAt: 1 })
  expect(await listHighlights(db, 'b')).toEqual([])
})

test('nota: grava sem espaços nas pontas e vazia apaga', async () => {
  const db = await setup()
  await addHighlight(db, { id: 'h', bookId: 'b', cfiRange: 'epubcfi(/6/2)', text: 'x', createdAt: 1 })
  await setHighlightNote(db, 'h', '  minha nota  ', 5)
  expect((await listHighlights(db, 'b'))[0]).toMatchObject({ note: 'minha nota', updatedAt: 5 })
  await setHighlightNote(db, 'h', '   ', 6)
  expect((await listHighlights(db, 'b'))[0]).toMatchObject({ note: null, updatedAt: 6 })
})

test('grifo guarda a cor do leitor web', async () => {
  const db = await setup()
  await addHighlight(db, { id: 'h', bookId: 'b', cfiRange: 'epubcfi(/6/4)', text: 'x', createdAt: 5 })
  expect((await listHighlights(db, 'b'))[0]).toMatchObject({ color: HIGHLIGHT_COLOR, updatedAt: 5, note: null })
})

test('apagar grifo com o Drive ligado registra a exclusão', async () => {
  const db = await setup()
  await setDriveEnabled(db, true)
  await addHighlight(db, { id: 'h', bookId: 'b', cfiRange: 'epubcfi(/6/4)', text: 'x', createdAt: 5 })
  await deleteHighlight(db, 'h', 70)
  expect(await db.getAll('SELECT * FROM deletions')).toEqual([{ key: 'highlight:h', deletedAt: 70 }])
})

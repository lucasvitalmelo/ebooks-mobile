import { migrate } from './migrations'
import { openTestDb } from './testing/node-db'
import { PRESET_THEMES } from './presets'

test('cria as tabelas e marca a versão', async () => {
  const db = openTestDb()
  await migrate(db)
  const tables = await db.getAll<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  expect(tables.map((t) => t.name)).toEqual(['books', 'highlights', 'progress', 'settings', 'themes'])
  expect(await db.getFirst('PRAGMA user_version')).toEqual({ user_version: 2 })
})

test('semeia os temas prontos uma vez só', async () => {
  const db = openTestDb()
  await migrate(db)
  await migrate(db)
  const rows = await db.getAll<{ id: string }>('SELECT id FROM themes')
  expect(rows).toHaveLength(PRESET_THEMES.length)
})

test('apagar o livro apaga o progresso', async () => {
  const db = openTestDb()
  await migrate(db)
  await db.run(
    "INSERT INTO books (id, title, author, filePath, size, addedAt) VALUES ('b', 't', 'a', 'books/b.epub', 1, 0)",
  )
  await db.run("INSERT INTO progress (bookId, cfi, percent, updatedAt) VALUES ('b', 'epubcfi(/6/2)', 0.1, 0)")
  await db.run("DELETE FROM books WHERE id = 'b'")
  expect(await db.getAll('SELECT * FROM progress')).toEqual([])
})

test('apagar o livro apaga os grifos', async () => {
  const db = openTestDb()
  await migrate(db)
  await db.run(
    "INSERT INTO books (id, title, author, filePath, size, addedAt) VALUES ('b', 't', 'a', 'books/b.epub', 1, 0)",
  )
  await db.run(
    "INSERT INTO highlights (id, bookId, cfiRange, text, createdAt, updatedAt) VALUES ('h', 'b', 'epubcfi(/6/2)', 'x', 0, 0)",
  )
  await db.run("DELETE FROM books WHERE id = 'b'")
  expect(await db.getAll('SELECT * FROM highlights')).toEqual([])
})

test('um banco na versão 1 sobe para a 2 sem perder livros', async () => {
  const db = openTestDb()
  await migrate(db)
  await db.run(
    "INSERT INTO books (id, title, author, filePath, size, addedAt) VALUES ('b', 't', 'a', 'books/b.epub', 1, 0)",
  )
  await db.exec('DROP TABLE highlights')
  await db.exec('PRAGMA user_version = 1')
  await migrate(db)
  expect(await db.getAll<{ id: string }>('SELECT id FROM books')).toEqual([{ id: 'b' }])
  expect(await db.getFirst('PRAGMA user_version')).toEqual({ user_version: 2 })
})

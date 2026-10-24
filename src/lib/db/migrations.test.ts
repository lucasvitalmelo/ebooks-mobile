import { migrate } from './migrations'
import { openTestDb } from './testing/node-db'
import { PRESET_THEMES } from './presets'
import { listThemes, saveTheme } from './themes'

test('cria as tabelas e marca a versão', async () => {
  const db = openTestDb()
  await migrate(db)
  const tables = await db.getAll<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  expect(tables.map((t) => t.name)).toEqual(['books', 'highlights', 'progress', 'settings', 'themes'])
  expect(await db.getFirst('PRAGMA user_version')).toEqual({ user_version: 3 })
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

test('um banco na versão 1 sobe para a 3 sem perder livros', async () => {
  const db = openTestDb()
  await migrate(db)
  await db.run(
    "INSERT INTO books (id, title, author, filePath, size, addedAt) VALUES ('b', 't', 'a', 'books/b.epub', 1, 0)",
  )
  await db.exec('DROP TABLE highlights')
  await db.exec('PRAGMA user_version = 1')
  await migrate(db)
  expect(await db.getAll<{ id: string }>('SELECT id FROM books')).toEqual([{ id: 'b' }])
  expect(await db.getFirst('PRAGMA user_version')).toEqual({ user_version: 3 })
})

test('migração 3: coluna de nota e tema Preto', async () => {
  const db = openTestDb()
  await migrate(db)
  const columns = await db.getAll<{ name: string }>('PRAGMA table_info(highlights)')
  expect(columns.map((c) => c.name)).toContain('note')
  expect(await db.getFirst('SELECT id, background FROM themes WHERE id = ?', ['preset-preto'])).toEqual({
    id: 'preset-preto',
    background: '#000000',
  })
})

test('um banco na versão 2 ganha o tema Preto sem duplicar os outros', async () => {
  const db = openTestDb()
  await migrate(db)
  await db.exec("DELETE FROM themes WHERE id = 'preset-preto'")
  await db.exec('ALTER TABLE highlights DROP COLUMN note')
  await db.exec('PRAGMA user_version = 2')
  await migrate(db)
  const rows = await db.getAll<{ id: string }>('SELECT id FROM themes WHERE builtin = 1')
  expect(rows).toHaveLength(PRESET_THEMES.length)
})

const presetIds = PRESET_THEMES.map((t) => t.id)

test('num banco novo, o Preto vem logo depois do Escuro', async () => {
  const db = openTestDb()
  await migrate(db)
  const ids = (await listThemes(db)).map((t) => t.id)
  expect(ids).toEqual(presetIds)
  expect(ids.indexOf('preset-preto')).toBe(ids.indexOf('preset-escuro') + 1)
})

test('num banco atualizado da versão 2, o Preto vem logo depois do Escuro e os próprios no fim', async () => {
  const db = openTestDb()
  await migrate(db)
  await db.exec("DELETE FROM themes WHERE id = 'preset-preto'")
  await db.exec('ALTER TABLE highlights DROP COLUMN note')
  await saveTheme(db, { ...PRESET_THEMES[0], id: 'custom-1', name: 'Meu', builtin: false })
  await db.exec('PRAGMA user_version = 2')
  await migrate(db)
  expect((await listThemes(db)).map((t) => t.id)).toEqual([...presetIds, 'custom-1'])
})

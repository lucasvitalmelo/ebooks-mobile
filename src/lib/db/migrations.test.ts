import { migrate, migrateTo } from './migrations'
import { openTestDb } from './testing/node-db'
import { PRESET_THEMES } from './presets'
import { listThemes, saveTheme } from './themes'

test('cria as tabelas e marca a versão', async () => {
  const db = openTestDb()
  await migrate(db)
  const tables = await db.getAll<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  expect(tables.map((t) => t.name)).toEqual(['books', 'deletions', 'highlights', 'progress', 'settings', 'themes'])
  expect(await db.getFirst('PRAGMA user_version')).toEqual({ user_version: 5 })
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

test('um banco na versão 1 sobe para a 5 sem perder livros', async () => {
  const db = openTestDb()
  await migrateTo(db, 1)
  await db.run(
    "INSERT INTO books (id, title, author, filePath, size, addedAt) VALUES ('b', 't', 'a', 'books/b.epub', 1, 0)",
  )
  await migrate(db)
  expect(await db.getAll<{ id: string }>('SELECT id FROM books')).toEqual([{ id: 'b' }])
  expect(await db.getFirst('PRAGMA user_version')).toEqual({ user_version: 5 })
})

test('migração 4: escala da fonte e livros a limpar', async () => {
  const db = openTestDb()
  await migrate(db)
  const columns = (await db.getAll<{ name: string }>('PRAGMA table_info(books)')).map((c) => c.name)
  expect(columns).toEqual(expect.arrayContaining(['fontScale', 'prepared']))
})

test('livros que já existiam ficam para limpar', async () => {
  const db = openTestDb()
  await migrateTo(db, 3)
  await db.run(
    "INSERT INTO books (id, title, author, filePath, size, addedAt) VALUES ('b', 't', 'a', 'books/b.epub', 1, 0)",
  )
  await migrate(db)
  expect(await db.getFirst('SELECT fontScale, prepared FROM books')).toEqual({ fontScale: null, prepared: 0 })
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
  await migrateTo(db, 2)
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
  await migrateTo(db, 2)
  await saveTheme(db, { ...PRESET_THEMES[0], id: 'custom-1', name: 'Meu', builtin: false })
  await migrate(db)
  expect((await listThemes(db)).map((t) => t.id)).toEqual([...presetIds, 'custom-1'])
})

test('migração 5 prepara a sincronização com o Drive', async () => {
  const db = openTestDb()
  await migrate(db)
  const version = await db.getFirst<{ user_version: number }>('PRAGMA user_version')
  expect(version?.user_version).toBe(5)

  const bookColumns = (await db.getAll<{ name: string }>('PRAGMA table_info(books)')).map((c) => c.name)
  expect(bookColumns).toEqual(
    expect.arrayContaining([
      'updatedAt',
      'fileUpdatedAt',
      'blobUpdatedAt',
      'pendingUpload',
      'driveFileId',
      'driveCoverId',
    ]),
  )
  const highlightColumns = (await db.getAll<{ name: string }>('PRAGMA table_info(highlights)')).map((c) => c.name)
  expect(highlightColumns).toContain('color')
  const progressCfi = (await db.getAll<{ name: string; notnull: number }>('PRAGMA table_info(progress)')).find(
    (c) => c.name === 'cfi',
  )
  expect(progressCfi?.notnull).toBe(0)
  expect(await db.getAll('SELECT * FROM deletions')).toEqual([])
})

test('migração 5 carimba os livros, grifos e progresso que já existiam', async () => {
  const db = openTestDb()
  // Para na versão 4 e cria dados como o app de antes.
  await migrateTo(db, 4)
  await db.run(
    "INSERT INTO books (id, title, author, filePath, coverPath, size, addedAt, prepared) VALUES ('b', 'T', 'A', 'books/b.epub', NULL, 10, 100, 1)",
  )
  await db.run("INSERT INTO progress (bookId, cfi, percent, updatedAt) VALUES ('b', 'epubcfi(/6/2)', 0.5, 300)")
  await db.run(
    "INSERT INTO highlights (id, bookId, cfiRange, text, createdAt, updatedAt) VALUES ('h', 'b', 'epubcfi(/6/4)', 'x', 200, 250)",
  )
  await migrate(db)
  expect(
    await db.getFirst(
      'SELECT updatedAt, fileUpdatedAt, blobUpdatedAt, pendingUpload, driveFileId, driveCoverId FROM books',
    ),
  ).toEqual({
    updatedAt: 100,
    fileUpdatedAt: 100,
    blobUpdatedAt: 100,
    pendingUpload: 1,
    driveFileId: null,
    driveCoverId: null,
  })
  expect(await db.getFirst('SELECT color FROM highlights')).toEqual({ color: '#fac73c' })
  expect(await db.getFirst('SELECT bookId, cfi, percent, updatedAt FROM progress')).toEqual({
    bookId: 'b',
    cfi: 'epubcfi(/6/2)',
    percent: 0.5,
    updatedAt: 300,
  })
})

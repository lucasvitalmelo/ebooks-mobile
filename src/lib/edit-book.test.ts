import { readFileSync } from 'fs'
import { getBook, insertBook } from './db/books'
import type { Db } from './db/db'
import { migrate } from './db/migrations'
import { openTestDb } from './db/testing/node-db'
import { editBook, type EditDeps } from './edit-book'

const fixture = new Uint8Array(readFileSync(`${__dirname}/../../fixtures/livro-de-teste.epub`))
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
const oldCover = new Uint8Array([9, 9, 9])

async function setup() {
  const db = openTestDb()
  await migrate(db)
  await insertBook(db, {
    id: 'b',
    title: 'Velho',
    author: 'X',
    filePath: 'books/b.epub',
    coverPath: 'covers/b.png',
    size: 1,
    addedAt: 0,
  })
  const files = new Map<string, Uint8Array>([
    ['books/b.epub', fixture],
    ['covers/b.png', oldCover],
  ])
  const deps: EditDeps = {
    db,
    readFile: async (path) => files.get(path)!,
    writeFile: async (path, bytes) => void files.set(path, bytes),
    replaceFile: async (path, bytes) => void files.set(path, bytes),
    deleteFiles: (paths) => paths.forEach((p) => p && files.delete(p)),
    now: () => 1000,
  }
  const book = (await getBook(db, 'b'))!
  return { db, deps, files, book }
}

// Um banco que recusa o UPDATE do livro e repassa o resto.
function failingBookUpdate(db: Db): Db {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => (sql.startsWith('UPDATE books') ? Promise.reject(new Error('banco')) : db.run(sql, params)),
    getAll: (sql, params) => db.getAll(sql, params),
    getFirst: (sql, params) => db.getFirst(sql, params),
    transaction: (fn) => db.transaction(fn),
  }
}

test('reescreve o arquivo, atualiza o banco e a capa', async () => {
  const { db, deps, files, book } = await setup()
  await editBook(deps, book, { title: 'Novo', author: 'Ana & Bia' })
  expect(await getBook(db, 'b')).toMatchObject({
    id: 'b',
    title: 'Novo',
    author: 'Ana & Bia',
    coverPath: 'covers/b.png',
  })
  expect(files.get('books/b.epub')).not.toBe(fixture)
})

test('editar carimba o livro e marca para enviar ao Drive', async () => {
  const { db, deps, book } = await setup()
  await db.run("UPDATE books SET pendingUpload = 0 WHERE id = 'b'")
  await editBook(deps, book, { title: 'Novo', author: 'Ana' })
  expect(await getBook(db, 'b')).toMatchObject({ updatedAt: 1000, fileUpdatedAt: 1000, pendingUpload: 1 })
})

test('falha ao gravar a capa: o livro e o banco ficam como estavam', async () => {
  const { db, deps, files, book } = await setup()
  await expect(
    editBook({ ...deps, writeFile: async () => Promise.reject(new Error('disco')) }, book, {
      title: 'Novo',
      author: 'A',
      cover: { bytes: jpeg, width: 600, height: 900, type: 'image/jpeg' },
    }),
  ).rejects.toThrow('disco')
  expect(files.get('books/b.epub')).toEqual(fixture)
  expect(await getBook(db, 'b')).toMatchObject({ title: 'Velho', coverPath: 'covers/b.png' })
})

test('falha ao trocar o arquivo do livro: o banco fica como estava', async () => {
  const { db, deps, files, book } = await setup()
  await expect(
    editBook({ ...deps, replaceFile: async () => Promise.reject(new Error('disco')) }, book, {
      title: 'Novo',
      author: 'A',
    }),
  ).rejects.toThrow('disco')
  expect(files.get('books/b.epub')).toEqual(fixture)
  expect((await getBook(db, 'b'))?.title).toBe('Velho')
})

test('falha no banco depois de trocar o arquivo: o livro volta ao original e a capa nova sai', async () => {
  const { db, deps, files, book } = await setup()
  await expect(
    editBook({ ...deps, db: failingBookUpdate(db) }, book, {
      title: 'Novo',
      author: 'A',
      cover: { bytes: jpeg, width: 600, height: 900, type: 'image/jpeg' },
    }),
  ).rejects.toThrow('banco')
  expect(files.get('books/b.epub')).toEqual(fixture)
  expect(files.has('covers/b.jpg')).toBe(false)
  expect(files.get('covers/b.png')).toEqual(oldCover)
  expect(await getBook(db, 'b')).toMatchObject({ title: 'Velho', coverPath: 'covers/b.png' })
})

test('falha no banco com a capa no mesmo caminho: a capa antiga volta', async () => {
  const { db, deps, files, book } = await setup()
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
  await expect(
    editBook({ ...deps, db: failingBookUpdate(db) }, book, {
      title: 'Novo',
      author: 'A',
      cover: { bytes: png, width: 600, height: 900, type: 'image/png' },
    }),
  ).rejects.toThrow('banco')
  expect(files.get('books/b.epub')).toEqual(fixture)
  expect(files.get('covers/b.png')).toEqual(oldCover)
})

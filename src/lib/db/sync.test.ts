import { coverPath } from '@/lib/book-paths'
import type { LocalChanges } from '@/lib/sync/merge'
import type { RemoteBook } from '@/lib/sync/library-file'
import { getBook, insertBook } from './books'
import { addHighlight } from './highlights'
import { migrate } from './migrations'
import { saveProgress } from './progress'
import {
  applyRemoteChanges,
  clearDeletions,
  getDriveFolders,
  listBooksMissingCover,
  listBooksToUpload,
  markBookUploaded,
  readLocalLibrary,
  saveDownloadedCover,
  setDriveFolders,
} from './sync'
import type { Db } from './db'
import { openTestDb } from './testing/node-db'

const noChanges = (): LocalChanges => ({
  books: [],
  removedBooks: [],
  progress: [],
  highlights: [],
  removedHighlights: [],
  deletions: [],
})

const remoteBook = (overrides: Partial<RemoteBook> = {}): RemoteBook => ({
  title: 'Da nuvem',
  author: 'Autora',
  addedAt: 100,
  updatedAt: 100,
  fileUpdatedAt: 100,
  fileId: 'file-1',
  coverId: 'cover-1',
  ...overrides,
})

async function setup() {
  const db = openTestDb()
  await migrate(db)
  return db
}

async function localBook(db: Awaited<ReturnType<typeof setup>>, id = 'a') {
  await insertBook(db, {
    id,
    title: 'T',
    author: 'A',
    filePath: `books/${id}.epub`,
    coverPath: null,
    size: 10,
    addedAt: 100,
  })
}

test('lê a biblioteca no formato do arquivo do Drive', async () => {
  const db = await setup()
  await localBook(db)
  await saveProgress(db, { bookId: 'a', cfi: 'epubcfi(/6/2)', percent: 0.426 }, 300)
  await addHighlight(db, { id: 'h', bookId: 'a', cfiRange: 'epubcfi(/6/4)', text: 'x', createdAt: 200 })
  const library = await readLocalLibrary(db)
  expect(library.books).toEqual([
    {
      id: 'a',
      title: 'T',
      author: 'A',
      addedAt: 100,
      updatedAt: 100,
      fileUpdatedAt: 100,
      driveFileId: null,
      driveCoverId: null,
      pendingUpload: true,
    },
  ])
  expect(library.progress).toEqual([{ bookId: 'a', cfi: 'epubcfi(/6/2)', percentage: 43, lastReadAt: 300 }])
  expect(library.highlights).toEqual([
    { id: 'h', bookId: 'a', cfiRange: 'epubcfi(/6/4)', text: 'x', color: '#fac73c', createdAt: 200, updatedAt: 200 },
  ])
})

test('um livro de outro aparelho chega só na nuvem', async () => {
  const db = await setup()
  const changes = noChanges()
  changes.books.push({ id: 'n', book: remoteBook({ fontScale: 1.2 }), expected: null })
  const applied = await applyRemoteChanges(db, changes)
  expect(applied).toMatchObject({ booksAdded: 1, booksRemoved: 0, other: 0, filesToDelete: [] })
  expect(await getBook(db, 'n')).toMatchObject({
    title: 'Da nuvem',
    filePath: 'books/n.epub',
    coverPath: null,
    size: 0,
    blobUpdatedAt: null,
    pendingUpload: 0,
    driveFileId: 'file-1',
    driveCoverId: 'cover-1',
    fontScale: 1.2,
    prepared: 1,
  })
  expect(await listBooksMissingCover(db)).toEqual([{ id: 'n', driveCoverId: 'cover-1' }])
})

test('progresso e grifo de outro aparelho entram convertidos', async () => {
  const db = await setup()
  await localBook(db)
  const changes = noChanges()
  changes.progress.push({
    bookId: 'a',
    progress: { cfi: 'epubcfi(/6/8)', percentage: 50, lastReadAt: 400 },
    expected: null,
  })
  changes.highlights.push({
    id: 'h2',
    highlight: {
      bookId: 'a',
      cfiRange: 'epubcfi(/6/10)',
      text: 'y',
      color: '#fac73c',
      note: 'n',
      createdAt: 1,
      updatedAt: 2,
    },
    expected: null,
  })
  await applyRemoteChanges(db, changes)
  expect(await db.getFirst('SELECT cfi, percent, updatedAt FROM progress')).toEqual({
    cfi: 'epubcfi(/6/8)',
    percent: 0.5,
    updatedAt: 400,
  })
  expect(await db.getFirst('SELECT note, updatedAt FROM highlights WHERE id = ?', ['h2'])).toEqual({
    note: 'n',
    updatedAt: 2,
  })
})

test('não sobrescreve o que mudou depois da junção', async () => {
  const db = await setup()
  await localBook(db)
  await saveProgress(db, { bookId: 'a', cfi: 'epubcfi(/6/2)', percent: 0.1 }, 900)
  const changes = noChanges()
  changes.progress.push({
    bookId: 'a',
    progress: { cfi: 'epubcfi(/6/8)', percentage: 50, lastReadAt: 400 },
    expected: 300,
  })
  await applyRemoteChanges(db, changes)
  expect(await db.getFirst('SELECT updatedAt FROM progress')).toEqual({ updatedAt: 900 })
})

// O leitor grava sem a trava da biblioteca: a escrita chega entre a leitura e a gravação da sincronização.
function writesJustBefore(db: Db, table: string, write: () => Promise<unknown>): Db {
  let done = false
  return {
    exec: (sql) => db.exec(sql),
    getAll: (sql, params) => db.getAll(sql, params),
    getFirst: (sql, params) => db.getFirst(sql, params),
    transaction: (fn) => db.transaction(fn),
    run: async (sql, params) => {
      if (!done && new RegExp(`^\\s*(INSERT|UPDATE|DELETE)\\b[^;]*\\b${table}\\b`, 'i').test(sql)) {
        done = true
        await write()
      }
      return db.run(sql, params)
    },
  }
}

test('progresso e grifo gravados aqui no meio da sincronização não são sobrescritos', async () => {
  const db = await setup()
  await localBook(db)
  await saveProgress(db, { bookId: 'a', cfi: 'epubcfi(/6/2)', percent: 0.1 }, 300)
  await addHighlight(db, { id: 'h', bookId: 'a', cfiRange: 'epubcfi(/6/4)', text: 'x', createdAt: 300 })
  const changes = noChanges()
  changes.progress.push({
    bookId: 'a',
    progress: { cfi: 'epubcfi(/6/8)', percentage: 50, lastReadAt: 400 },
    expected: 300,
  })
  changes.highlights.push({
    id: 'h',
    highlight: {
      bookId: 'a',
      cfiRange: 'epubcfi(/6/4)',
      text: 'x',
      color: '#fac73c',
      note: 'de lá',
      createdAt: 300,
      updatedAt: 400,
    },
    expected: 300,
  })
  const racing = writesJustBefore(
    writesJustBefore(db, 'progress', () => saveProgress(db, { bookId: 'a', cfi: 'epubcfi(/6/6)', percent: 0.3 }, 900)),
    'highlights',
    () => db.run("UPDATE highlights SET note = 'daqui', updatedAt = 900 WHERE id = 'h'"),
  )
  const applied = await applyRemoteChanges(racing, changes)
  expect(applied.other).toBe(0)
  expect(await db.getFirst('SELECT cfi, updatedAt FROM progress')).toEqual({ cfi: 'epubcfi(/6/6)', updatedAt: 900 })
  expect(await db.getFirst('SELECT note, updatedAt FROM highlights')).toEqual({ note: 'daqui', updatedAt: 900 })
})

test('livro editado aqui no meio da sincronização não é sobrescrito nem removido', async () => {
  const db = await setup()
  await localBook(db, 'a')
  await localBook(db, 'b')
  const changes = noChanges()
  changes.books.push({ id: 'a', book: remoteBook({ title: 'De lá', updatedAt: 400 }), expected: 100 })
  changes.removedBooks.push({ id: 'b', expected: 100 })
  const racing = writesJustBefore(
    writesJustBefore(db, 'books', () => db.run("UPDATE books SET title = 'Daqui', updatedAt = 900 WHERE id = 'a'")),
    'books',
    () => db.run("UPDATE books SET updatedAt = 900 WHERE id = 'b'"),
  )
  const applied = await applyRemoteChanges(racing, changes)
  expect(applied).toMatchObject({ other: 0, booksRemoved: 0, filesToDelete: [] })
  expect(await getBook(db, 'a')).toMatchObject({ title: 'Daqui', updatedAt: 900 })
  expect(await getBook(db, 'b')).not.toBeNull()
})

test('livro novo que chegou aqui no meio não é duplicado nem conta como chegado', async () => {
  const db = await setup()
  const changes = noChanges()
  changes.books.push({ id: 'a', book: remoteBook(), expected: null })
  const racing = writesJustBefore(db, 'books', () => localBook(db, 'a'))
  const applied = await applyRemoteChanges(racing, changes)
  expect(applied.booksAdded).toBe(0)
  expect(await getBook(db, 'a')).toMatchObject({ title: 'T' })
})

test('livro removido em outro aparelho sai daqui com os arquivos', async () => {
  const db = await setup()
  await localBook(db)
  await db.run("UPDATE books SET coverPath = 'covers/a.jpg' WHERE id = 'a'")
  const changes = noChanges()
  changes.removedBooks.push({ id: 'a', expected: 100 })
  const applied = await applyRemoteChanges(db, changes)
  expect(applied.booksRemoved).toBe(1)
  expect(applied.filesToDelete).toEqual(['books/a.epub', 'covers/a.jpg'])
  expect(await getBook(db, 'a')).toBeNull()
})

test('edição de outro aparelho troca a capa e pede o arquivo de novo', async () => {
  const db = await setup()
  await localBook(db)
  await db.run("UPDATE books SET coverPath = 'covers/a.jpg', pendingUpload = 0, driveFileId = 'file-1' WHERE id = 'a'")
  const changes = noChanges()
  changes.books.push({
    id: 'a',
    book: remoteBook({ updatedAt: 500, fileUpdatedAt: 500, coverId: 'cover-2' }),
    expected: 100,
  })
  const applied = await applyRemoteChanges(db, changes)
  expect(applied.filesToDelete).toEqual(['covers/a.jpg'])
  expect(await getBook(db, 'a')).toMatchObject({
    updatedAt: 500,
    fileUpdatedAt: 500,
    blobUpdatedAt: 100,
    coverPath: null,
  })
})

test('enviar: lista, marca e respeita a edição no meio', async () => {
  const db = await setup()
  await localBook(db)
  expect((await listBooksToUpload(db)).map((b) => b.id)).toEqual(['a'])
  expect(
    await markBookUploaded(db, 'a', { driveFileId: 'f', driveCoverId: null }, { updatedAt: 1, fileUpdatedAt: 1 }),
  ).toBe(false)
  expect(await getBook(db, 'a')).toMatchObject({ driveFileId: 'f', pendingUpload: 1 })
  expect(
    await markBookUploaded(db, 'a', { driveFileId: 'f', driveCoverId: 'c' }, { updatedAt: 100, fileUpdatedAt: 100 }),
  ).toBe(true)
  expect(await listBooksToUpload(db)).toEqual([])
})

test('pastas, capa baixada e primeira sincronização', async () => {
  const db = await setup()
  expect(await getDriveFolders(db)).toBeNull()
  await setDriveFolders(db, { root: 'r', data: 'd', covers: 'c' })
  expect(await getDriveFolders(db)).toEqual({ root: 'r', data: 'd', covers: 'c' })
  await localBook(db)
  await db.run("UPDATE books SET driveCoverId = 'c1' WHERE id = 'a'")
  // Outra capa no Drive desde a listagem: não grava.
  expect(await saveDownloadedCover(db, 'a', coverPath('a', 'png'), 'c0')).toBe(false)
  expect((await getBook(db, 'a'))?.coverPath).toBeNull()
  expect(await saveDownloadedCover(db, 'a', coverPath('a', 'png'), 'c1')).toBe(true)
  expect((await getBook(db, 'a'))?.coverPath).toBe('covers/a.png')
  // Já tem capa (uma edição chegou antes): não troca.
  expect(await saveDownloadedCover(db, 'a', coverPath('a', 'jpg'), 'c1')).toBe(false)
  expect((await getBook(db, 'a'))?.coverPath).toBe('covers/a.png')
  await db.run("INSERT INTO deletions (key, deletedAt) VALUES ('book:x', 1)")
  expect(await clearDeletions(db)).toBe(1)
})

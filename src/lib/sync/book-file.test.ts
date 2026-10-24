import { bookPath } from '@/lib/book-paths'
import { getBook, insertBook } from '@/lib/db/books'
import { migrate } from '@/lib/db/migrations'
import { openTestDb } from '@/lib/db/testing/node-db'
import { BookNotHereError, downloadBook, ensureBookFile, needsDownload, type BookFileDeps } from './book-file'

async function setup(download: () => Promise<Uint8Array>) {
  const db = openTestDb()
  await migrate(db)
  const written = new Map<string, Uint8Array>()
  const deps: BookFileDeps = {
    db,
    api: { downloadBytes: download } as never,
    replaceFile: async (path, bytes) => void written.set(path, bytes),
    lock: (fn) => fn(),
  }
  await insertBook(db, {
    id: 'a',
    title: 'T',
    author: 'A',
    filePath: bookPath('a'),
    coverPath: null,
    size: 1,
    addedAt: 100,
  })
  return { db, deps, written }
}

test('livro daqui e em dia não precisa baixar', async () => {
  const { db } = await setup(async () => new Uint8Array())
  expect(needsDownload((await getBook(db, 'a'))!)).toBe(false)
})

test('baixa o livro que só está na nuvem e guarda a versão', async () => {
  const { db, deps, written } = await setup(async () => new Uint8Array([1, 2, 3]))
  await db.run("UPDATE books SET blobUpdatedAt = NULL, driveFileId = 'f' WHERE id = 'a'")
  await ensureBookFile(deps, (await getBook(db, 'a'))!)
  expect(written.get(bookPath('a'))).toEqual(new Uint8Array([1, 2, 3]))
  expect(await getBook(db, 'a')).toMatchObject({ blobUpdatedAt: 100, size: 3 })
})

test('livro excluído durante o download não ganha o arquivo de volta', async () => {
  let db: Awaited<ReturnType<typeof setup>>['db'] | null = null
  const ctx = await setup(async () => {
    await db!.run("DELETE FROM books WHERE id = 'a'")
    return new Uint8Array([1])
  })
  db = ctx.db
  await ctx.db.run("UPDATE books SET blobUpdatedAt = NULL, driveFileId = 'f' WHERE id = 'a'")
  const book = (await getBook(ctx.db, 'a'))!
  await downloadBook(ctx.deps, book)
  expect(ctx.written.size).toBe(0)
})

test('o download passa a gravação pela trava da biblioteca', async () => {
  const { db, deps, written } = await setup(async () => new Uint8Array([1]))
  await db.run("UPDATE books SET blobUpdatedAt = NULL, driveFileId = 'f' WHERE id = 'a'")
  let locked = false
  deps.lock = async (fn) => {
    locked = true
    const result = await fn()
    locked = false
    return result
  }
  const replaceFile = deps.replaceFile
  let writtenLocked = false
  deps.replaceFile = async (path, bytes) => {
    writtenLocked = locked
    await replaceFile(path, bytes)
  }
  await downloadBook(deps, (await getBook(db, 'a'))!)
  expect(writtenLocked).toBe(true)
  expect(written.size).toBe(1)
})

test('o download pode vir de fora (o mesmo do botão de baixar)', async () => {
  const { db, deps, written } = await setup(async () => new Uint8Array([1]))
  await db.run("UPDATE books SET blobUpdatedAt = NULL, driveFileId = 'f' WHERE id = 'a'")
  const shared: string[] = []
  await ensureBookFile(deps, (await getBook(db, 'a'))!, async (book) => void shared.push(book.id))
  expect(shared).toEqual(['a'])
  expect(written.size).toBe(0)
})

test('sem rede, a versão antiga daqui ainda abre', async () => {
  const { db, deps } = await setup(async () => Promise.reject(new TypeError('Network request failed')))
  await db.run("UPDATE books SET blobUpdatedAt = 50, driveFileId = 'f' WHERE id = 'a'")
  await expect(ensureBookFile(deps, (await getBook(db, 'a'))!)).resolves.toBeUndefined()
})

test('sem rede e sem arquivo aqui, avisa', async () => {
  const { db, deps } = await setup(async () => Promise.reject(new TypeError('Network request failed')))
  await db.run("UPDATE books SET blobUpdatedAt = NULL, driveFileId = 'f' WHERE id = 'a'")
  await expect(ensureBookFile(deps, (await getBook(db, 'a'))!)).rejects.toBeInstanceOf(BookNotHereError)
})

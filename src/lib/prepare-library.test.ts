import { readFileSync } from 'fs'
import JSZip from 'jszip'
import { getBook, insertBook, listUnprepared } from './db/books'
import { migrate } from './db/migrations'
import { openTestDb } from './db/testing/node-db'
import { prepareLibrary, type PrepareDeps } from './prepare-library'

const fixture = new Uint8Array(readFileSync(`${__dirname}/../../fixtures/livro-de-teste.epub`))

async function epubWithCss(css: string) {
  const zip = await JSZip.loadAsync(fixture)
  zip.file('OEBPS/estilo.css', css)
  return zip.generateAsync({ type: 'uint8array' })
}

const dirtyEpub = () => epubWithCss('p { color: red }')

async function setup(files: Map<string, Uint8Array>) {
  const db = openTestDb()
  await migrate(db)
  for (const id of ['a', 'b']) {
    await insertBook(db, {
      id,
      title: id,
      author: 'x',
      filePath: `books/${id}.epub`,
      coverPath: null,
      size: 1,
      addedAt: 0,
    })
  }
  await db.exec('UPDATE books SET prepared = 0')
  const deps: PrepareDeps = {
    db,
    readFile: async (path) => {
      const bytes = files.get(path)
      if (!bytes) throw new Error('sem arquivo')
      return bytes
    },
    replaceFile: async (path, bytes) => void files.set(path, bytes),
  }
  return { db, deps }
}

test('limpa os livros que faltam e marca todos', async () => {
  const dirty = await dirtyEpub()
  const clean = await epubWithCss('p { margin: 0 }')
  const files = new Map([
    ['books/a.epub', dirty],
    ['books/b.epub', clean],
  ])
  const { db, deps } = await setup(files)
  await prepareLibrary(deps)
  const cleaned = await JSZip.loadAsync(files.get('books/a.epub')!)
  expect(await cleaned.file('OEBPS/estilo.css')!.async('string')).not.toMatch(/color/)
  expect(files.get('books/b.epub') === clean).toBe(true)
  expect(await listUnprepared(db)).toEqual([])
})

test('um livro removido entre a listagem e o processamento não é recriado', async () => {
  const files = new Map([
    ['books/a.epub', await dirtyEpub()],
    ['books/b.epub', await dirtyEpub()],
  ])
  const { db, deps } = await setup(files)
  const readFile = deps.readFile
  let removed = false
  deps.readFile = async (path) => {
    // Enquanto o "a" é lido, o "b" é removido por outra operação.
    if (!removed) {
      removed = true
      await db.run('DELETE FROM books WHERE id = ?', ['b'])
    }
    return readFile(path)
  }
  const replaced: string[] = []
  const replaceFile = deps.replaceFile
  deps.replaceFile = async (path, bytes) => {
    replaced.push(path)
    await replaceFile(path, bytes)
  }
  await prepareLibrary(deps)
  expect(replaced).toEqual(['books/a.epub'])
  expect(await getBook(db, 'b')).toBeNull()
})

test('um livro que falha não trava os outros e não é tentado de novo', async () => {
  const files = new Map([['books/b.epub', await dirtyEpub()]])
  const { db, deps } = await setup(files)
  await prepareLibrary(deps)
  expect(await listUnprepared(db)).toEqual([])
  expect((await getBook(db, 'a'))?.prepared).toBe(1)
})

import { readFileSync } from 'fs'
import JSZip from 'jszip'
import { bookPath, coverPath } from './book-paths'
import { getBook, listBooks } from './db/books'
import type { Db } from './db/db'
import { migrate } from './db/migrations'
import { getProgress, saveProgress } from './db/progress'
import { openTestDb } from './db/testing/node-db'
import { formatSummary, importBooks, removeBook, type ImportDeps } from './import'

const FIXTURE = 'file:///cache/livro.epub'
const fixtureBytes = readFileSync(`${__dirname}/../../fixtures/livro-de-teste.epub`)

async function setup(overrides: Partial<ImportDeps> = {}) {
  const db = openTestDb()
  await migrate(db)
  const stored = new Set<string>()
  const discarded: string[] = []
  const deps: ImportDeps = {
    db,
    readBytes: async (uri) => (uri === FIXTURE ? fixtureBytes : new Uint8Array([1, 2, 3])),
    storeBook: async (id) => {
      stored.add(bookPath(id))
    },
    storeCover: async (id, _bytes, extension) => {
      stored.add(coverPath(id, extension))
    },
    deleteFiles: (paths) => paths.forEach((path) => path && stored.delete(path)),
    discardPicked: (uri) => {
      discarded.push(uri)
    },
    now: () => 1000,
    ...overrides,
  }
  return { db, deps, stored, discarded }
}

async function epubWithoutCover(title: string) {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip')
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="pkg.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  )
  zip.file(
    'pkg.opf',
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>Autor</dc:creator></metadata><manifest></manifest></package>`,
  )
  return zip.generateAsync({ type: 'uint8array' })
}

test('importa o livro, a capa e grava no banco', async () => {
  const { db, deps, stored } = await setup()
  const summary = await importBooks(deps, [{ uri: FIXTURE, name: 'livro.epub' }])
  expect(summary).toEqual({ imported: ['O Relógio Parado da Sala'], duplicates: [], invalid: [] })
  const [book] = await listBooks(db)
  expect(book).toMatchObject({
    title: 'O Relógio Parado da Sala',
    author: 'Joana Vieira',
    addedAt: 1000,
    size: fixtureBytes.length,
  })
  expect(stored).toEqual(new Set([book.filePath, book.coverPath]))
})

test('não importa duas vezes o mesmo livro', async () => {
  const { db, deps } = await setup()
  await importBooks(deps, [{ uri: FIXTURE, name: 'livro.epub' }])
  const summary = await importBooks(deps, [{ uri: FIXTURE, name: 'copia.epub' }])
  expect(summary.duplicates).toEqual(['O Relógio Parado da Sala'])
  expect(await listBooks(db)).toHaveLength(1)
})

test('arquivo inválido entra no resumo com o motivo e não para os outros', async () => {
  const { db, deps } = await setup()
  const summary = await importBooks(deps, [
    { uri: 'file:///cache/lixo.epub', name: 'lixo.epub' },
    { uri: FIXTURE, name: 'livro.epub' },
  ])
  expect(summary.invalid).toEqual([{ name: 'lixo.epub', reason: 'Não é um arquivo EPUB' }])
  expect(summary.imported).toHaveLength(1)
  expect(await listBooks(db)).toHaveLength(1)
})

test('falha no meio apaga o que já foi copiado', async () => {
  const { db, deps, stored } = await setup({
    storeCover: async () => {
      throw new Error('Disco cheio')
    },
  })
  const summary = await importBooks(deps, [{ uri: FIXTURE, name: 'livro.epub' }])
  expect(summary.invalid).toEqual([{ name: 'livro.epub', reason: 'Disco cheio' }])
  expect(stored.size).toBe(0)
  expect(await listBooks(db)).toEqual([])
})

test('remover apaga do banco e os arquivos', async () => {
  const { db, deps, stored } = await setup()
  await importBooks(deps, [{ uri: FIXTURE, name: 'livro.epub' }])
  const [book] = await listBooks(db)
  await removeBook(deps, book)
  expect(await getBook(db, book.id)).toBeNull()
  expect(stored.size).toBe(0)
})

test('resumo em português', () => {
  expect(
    formatSummary({
      imported: ['A', 'B'],
      duplicates: ['C'],
      invalid: [{ name: 'x.epub', reason: 'Não é um arquivo EPUB' }],
    }),
  ).toBe('2 importados.\n1 já estava na biblioteca: C\nNão importado: x.epub (Não é um arquivo EPUB)')
  expect(formatSummary({ imported: ['A'], duplicates: [], invalid: [] })).toBe('1 importado.')
  expect(formatSummary({ imported: [], duplicates: ['C', 'D'], invalid: [] })).toBe('2 já estavam na biblioteca: C, D')
})

test('falha no meio da cópia do livro apaga o arquivo parcial', async () => {
  const { db, deps, stored } = await setup()
  deps.storeBook = async (id) => {
    stored.add(bookPath(id))
    throw new Error('Cópia interrompida')
  }
  const summary = await importBooks(deps, [{ uri: FIXTURE, name: 'livro.epub' }])
  expect(summary.invalid).toEqual([{ name: 'livro.epub', reason: 'Cópia interrompida' }])
  expect(stored.size).toBe(0)
  expect(await listBooks(db)).toEqual([])
})

test('descarta a cópia do seletor de cada arquivo: importado, duplicado e inválido', async () => {
  const { deps, discarded } = await setup()
  await importBooks(deps, [{ uri: FIXTURE, name: 'a.epub' }])
  await importBooks(deps, [
    { uri: FIXTURE, name: 'b.epub' },
    { uri: 'file:///cache/lixo.epub', name: 'lixo.epub' },
  ])
  expect(discarded).toEqual([FIXTURE, FIXTURE, 'file:///cache/lixo.epub'])
})

test('remover também apaga o progresso do livro', async () => {
  const { db, deps } = await setup()
  await importBooks(deps, [{ uri: FIXTURE, name: 'livro.epub' }])
  const [book] = await listBooks(db)
  await saveProgress(db, { bookId: book.id, cfi: 'epubcfi(/6/2)', percent: 0.5 }, 2000)
  expect(await getProgress(db, book.id)).not.toBeNull()
  await removeBook(deps, book)
  expect(await getProgress(db, book.id)).toBeNull()
})

test('livro sem capa fica com coverPath nulo', async () => {
  const bytes = await epubWithoutCover('Sem Capa')
  const { db, deps, stored } = await setup({ readBytes: async () => bytes })
  const summary = await importBooks(deps, [{ uri: 'file:///cache/sem.epub', name: 'sem.epub' }])
  expect(summary.imported).toEqual(['Sem Capa'])
  const [book] = await listBooks(db)
  expect(book.coverPath).toBeNull()
  expect(stored).toEqual(new Set([book.filePath]))
})

test('importa dois livros diferentes na mesma leva', async () => {
  const other = await epubWithoutCover('Outro Livro')
  const { db, deps } = await setup({ readBytes: async (uri) => (uri === FIXTURE ? fixtureBytes : other) })
  const summary = await importBooks(deps, [
    { uri: FIXTURE, name: 'a.epub' },
    { uri: 'file:///cache/b.epub', name: 'b.epub' },
  ])
  expect(summary.imported).toEqual(['O Relógio Parado da Sala', 'Outro Livro'])
  expect(await listBooks(db)).toHaveLength(2)
})

test('falha ao gravar no banco também desfaz os arquivos', async () => {
  const { db, deps, stored } = await setup()
  const failingDb: Db = {
    ...db,
    run: async (sql, params) => {
      if (sql.startsWith('INSERT INTO books')) throw new Error('Banco travado')
      return db.run(sql, params)
    },
  }
  const summary = await importBooks({ ...deps, db: failingDb }, [{ uri: FIXTURE, name: 'livro.epub' }])
  expect(summary.invalid).toEqual([{ name: 'livro.epub', reason: 'Banco travado' }])
  expect(stored.size).toBe(0)
})

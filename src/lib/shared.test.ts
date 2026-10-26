import { readFileSync } from 'fs'
import { migrate } from './db/migrations'
import { openTestDb } from './db/testing/node-db'
import type { ImportDeps } from './import'
import { importShared } from './shared'

const FIXTURE = 'file:///cache/shared/1'
const fixtureBytes = readFileSync(`${__dirname}/../../fixtures/livro-de-teste.epub`)

async function setup() {
  const db = openTestDb()
  await migrate(db)
  const discarded: string[] = []
  const deps: ImportDeps = {
    db,
    readBytes: async () => fixtureBytes,
    storeBook: async () => {},
    storeCover: async () => {},
    deleteFiles: () => {},
    discardPicked: (uri) => {
      discarded.push(uri)
    },
    now: () => 1000,
  }
  return { deps, discarded }
}

test('importa os arquivos copiados e descarta as cópias', async () => {
  const { deps, discarded } = await setup()
  const summary = await importShared(deps, [{ uri: FIXTURE, name: 'livro.epub' }])
  expect(summary).toEqual({ imported: ['O Relógio Parado da Sala'], duplicates: [], invalid: [] })
  expect(discarded).toEqual([FIXTURE])
})

test('arquivo que não deu para ler vira não importado', async () => {
  const { deps, discarded } = await setup()
  const summary = await importShared(deps, [
    { uri: null, name: 'quebrado.pdf' },
    { uri: FIXTURE, name: 'livro.epub' },
  ])
  expect(summary.imported).toEqual(['O Relógio Parado da Sala'])
  expect(summary.invalid).toEqual([{ name: 'quebrado.pdf', reason: 'Não foi possível ler o arquivo' }])
  expect(discarded).toEqual([FIXTURE])
})

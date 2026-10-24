import { libraryBooks, pickContinue } from './library'

const shelf = [
  { id: 'aqui', blobUpdatedAt: 10 },
  { id: 'nuvem', blobUpdatedAt: null },
]

test('desconectado do Drive, os livros só da nuvem saem da biblioteca (#53)', () => {
  expect(libraryBooks(shelf, 'desconectado').map((b) => b.id)).toEqual(['aqui'])
})

test('conectado, sem internet ou ainda verificando, todos aparecem', () => {
  for (const status of ['conectado', 'indisponivel', 'reconectar', 'verificando'] as const) {
    expect(libraryBooks(shelf, status).map((b) => b.id)).toEqual(['aqui', 'nuvem'])
  }
})

const row = (id: string, lastOpenedAt: number | null, percent: number | null) => ({ id, lastOpenedAt, percent })

test('o mais recente com leitura em andamento', () => {
  expect(pickContinue([row('a', 30, 1), row('b', 20, 0.4), row('c', 10, 0.2)])?.id).toBe('b')
})

test('sem leitura em andamento, o último aberto', () => {
  expect(pickContinue([row('a', 30, 1), row('b', null, null)])?.id).toBe('a')
})

test('nenhum aberto, nada', () => {
  expect(pickContinue([row('a', null, null)])).toBeNull()
  expect(pickContinue([])).toBeNull()
})

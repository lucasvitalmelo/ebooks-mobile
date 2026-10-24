import { SyncError, type SyncSummary } from '@/lib/sync/run'
import { createSyncStore, type SyncStoreDeps } from './sync-store'

const db = {} as never
const summary = (overrides: Partial<SyncSummary> = {}): SyncSummary => ({
  applied: 0,
  booksAdded: 0,
  booksRemoved: 0,
  uploaded: 0,
  skipped: 0,
  covers: 0,
  ...overrides,
})

function setup(overrides: Partial<SyncStoreDeps> = {}) {
  const notices: string[] = []
  const deps: SyncStoreDeps = {
    isConnected: () => true,
    sync: async () => summary(),
    onAccountProblem: () => {},
    notify: (text) => notices.push(text),
    now: () => 1000,
    ...overrides,
  }
  return { store: createSyncStore(deps), notices }
}

test('não faz nada desconectado', async () => {
  const { store } = setup({ isConnected: () => false })
  expect(await store.getState().run(db)).toBeNull()
})

test('anuncia livros que chegaram e saíram, e recarrega', async () => {
  const { store, notices } = setup({ sync: async () => summary({ applied: 3, booksAdded: 2, booksRemoved: 1 }) })
  await store.getState().run(db)
  expect(notices).toEqual(['2 livros chegaram de outro aparelho', '1 livro foi removido em outro aparelho'])
  expect(store.getState()).toMatchObject({ status: 'parado', lastSyncAt: 1000, revision: 1 })
})

test('livros recusados viram erro na faixa', async () => {
  const { store } = setup({ sync: async () => summary({ skipped: 2 }) })
  await store.getState().run(db)
  expect(store.getState()).toMatchObject({
    status: 'erro',
    problem: 'recusados',
    error: '2 livros não subiram para o Google Drive.',
  })
})

test('erro de conta pede para verificar o login', async () => {
  let checked = 0
  const { store } = setup({
    sync: async () => Promise.reject(new SyncError('conta', 'Conecte o Google Drive de novo para sincronizar.')),
    onAccountProblem: () => checked++,
  })
  await store.getState().run(db)
  expect(store.getState()).toMatchObject({ status: 'erro', problem: 'conta' })
  expect(checked).toBe(1)
})

test('chamada durante uma sincronização pede outra logo depois', async () => {
  let calls = 0
  let release: () => void = () => {}
  const { store } = setup({
    sync: () => {
      calls++
      return calls === 1 ? new Promise((resolve) => (release = () => resolve(summary()))) : Promise.resolve(summary())
    },
  })
  const first = store.getState().run(db)
  expect(await store.getState().run(db)).toBeNull()
  release()
  await first
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(calls).toBe(2)
})

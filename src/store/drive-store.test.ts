import { isDriveEnabled } from '@/lib/db/deletions'
import { migrate } from '@/lib/db/migrations'
import { openTestDb } from '@/lib/db/testing/node-db'
import { DriveAuthError } from '@/lib/drive/auth-error'
import { createDriveStore, type DriveAuth } from './drive-store'

function fakeAuth(overrides: Partial<DriveAuth> = {}): DriveAuth {
  return {
    getAccessToken: async () => 'token',
    currentAccount: () => ({ email: 'lucas@exemplo.com', name: 'Lucas' }),
    connect: async () => ({ email: 'lucas@exemplo.com', name: 'Lucas' }),
    disconnect: async () => {},
    invalidateToken: () => {},
    ...overrides,
  }
}

async function setup(auth: DriveAuth) {
  const db = openTestDb()
  await migrate(db)
  return { db, store: createDriveStore(auth) }
}

test('com login guardado, fica conectado e liga o registro de exclusões', async () => {
  const { db, store } = await setup(fakeAuth())
  await store.getState().check(db)
  expect(store.getState()).toMatchObject({ status: 'conectado', account: { email: 'lucas@exemplo.com' } })
  expect(await isDriveEnabled(db)).toBe(true)
})

test('sem login, desconectado', async () => {
  const { db, store } = await setup(
    fakeAuth({ getAccessToken: async () => Promise.reject(new DriveAuthError('desconectado', 'x')) }),
  )
  await store.getState().check(db)
  expect(store.getState().status).toBe('desconectado')
  expect(await isDriveEnabled(db)).toBe(false)
})

test('cancelar o login deixa como estava', async () => {
  const { db, store } = await setup(fakeAuth({ connect: async () => null }))
  expect(await store.getState().connect(db)).toBe(false)
  expect(store.getState().status).toBe('verificando')
})

test('desconectar desliga o registro de exclusões', async () => {
  const { db, store } = await setup(fakeAuth())
  await store.getState().connect(db)
  await store.getState().disconnect(db)
  expect(store.getState()).toMatchObject({ status: 'desconectado', account: null })
  expect(await isDriveEnabled(db)).toBe(false)
})

test('um check que responde depois de desconectar não reconecta e esquece o token', async () => {
  let answer: (token: string) => void = () => {}
  let invalidated = 0
  const { db, store } = await setup(
    fakeAuth({
      getAccessToken: () => new Promise((resolve) => (answer = resolve)),
      invalidateToken: () => void invalidated++,
    }),
  )
  const checking = store.getState().check(db)
  await store.getState().disconnect(db)
  answer('token')
  await checking
  expect(store.getState().status).toBe('desconectado')
  expect(invalidated).toBe(1)
})

test('desconectar enquanto o check grava não deixa conectado', async () => {
  let invalidated = 0
  const db = openTestDb()
  await migrate(db)
  const store = createDriveStore(fakeAuth({ invalidateToken: () => void invalidated++ }))
  let disconnecting: Promise<void> | null = null
  const racing = {
    exec: (sql: string) => db.exec(sql),
    getAll: db.getAll.bind(db),
    getFirst: db.getFirst.bind(db),
    transaction: (fn: () => Promise<void>) => db.transaction(fn),
    run: async (sql: string, params?: (string | number | null)[]) => {
      const result = await db.run(sql, params)
      disconnecting ??= store.getState().disconnect(db)
      return result
    },
  } as typeof db
  await store.getState().check(racing)
  await disconnecting
  expect(store.getState()).toMatchObject({ status: 'desconectado', account: null })
  expect(invalidated).toBe(1)
  expect(await isDriveEnabled(db)).toBe(false)
})

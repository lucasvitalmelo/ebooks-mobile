import { migrate } from '@/lib/db/migrations'
import { getDriveFolders } from '@/lib/db/sync'
import { openTestDb } from '@/lib/db/testing/node-db'
import { FakeDrive } from './fake-drive'
import { ensureFolders, MissingFolderError } from './folders'

async function setup() {
  const db = openTestDb()
  await migrate(db)
  return { db, drive: new FakeDrive() }
}

test('cria MyBooks, Dados do app e capas e lembra', async () => {
  const { db, drive } = await setup()
  const folders = await ensureFolders(db, drive)
  const names = [...drive.files.values()].map((f) => f.name).sort()
  expect(names).toEqual(['Dados do app', 'MyBooks', 'capas'])
  expect(await getDriveFolders(db)).toEqual(folders)
})

test('acha as pastas que o web já criou', async () => {
  const { db, drive } = await setup()
  const web = await setup()
  const fromWeb = await ensureFolders(web.db, drive)
  expect(await ensureFolders(db, drive)).toEqual(fromWeb)
  expect(drive.files.size).toBe(3)
})

test('pasta lembrada que sumiu é avisada, não recriada', async () => {
  const { db, drive } = await setup()
  const folders = await ensureFolders(db, drive)
  drive.files.get(folders.data)!.trashed = true
  await expect(ensureFolders(db, drive)).rejects.toBeInstanceOf(MissingFolderError)
})

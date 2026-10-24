import { migrate } from './migrations'
import { openTestDb } from './testing/node-db'
import { bookDeletionKey, highlightDeletionKey, isDriveEnabled, recordDeletion, setDriveEnabled } from './deletions'

async function setup() {
  const db = openTestDb()
  await migrate(db)
  return db
}

test('o Drive começa desligado e lembra quando liga', async () => {
  const db = await setup()
  expect(await isDriveEnabled(db)).toBe(false)
  await setDriveEnabled(db, true)
  expect(await isDriveEnabled(db)).toBe(true)
  await setDriveEnabled(db, false)
  expect(await isDriveEnabled(db)).toBe(false)
})

test('só registra exclusão com o Drive ligado', async () => {
  const db = await setup()
  await recordDeletion(db, bookDeletionKey('a'), 10)
  expect(await db.getAll('SELECT * FROM deletions')).toEqual([])
  await setDriveEnabled(db, true)
  await recordDeletion(db, highlightDeletionKey('h'), 20)
  await recordDeletion(db, highlightDeletionKey('h'), 30)
  expect(await db.getAll('SELECT * FROM deletions')).toEqual([{ key: 'highlight:h', deletedAt: 30 }])
})

import { migrate } from './migrations'
import { getSetting, setSetting } from './settings'
import { openTestDb } from './testing/node-db'

test('grava e lê configurações', async () => {
  const db = openTestDb()
  await migrate(db)
  expect(await getSetting(db, 'activeThemeId')).toBeNull()
  await setSetting(db, 'activeThemeId', 'preset-escuro')
  await setSetting(db, 'activeThemeId', 'preset-sepia')
  expect(await getSetting(db, 'activeThemeId')).toBe('preset-sepia')
})

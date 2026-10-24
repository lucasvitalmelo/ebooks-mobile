import type { Db } from './db'

export type SettingKey = 'activeThemeId' | 'keepAwake' | 'warmth' | 'driveEnabled' | 'driveFolders'

export async function getSetting(db: Db, key: SettingKey): Promise<string | null> {
  const row = await db.getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
  return row?.value ?? null
}

export async function setSetting(db: Db, key: SettingKey, value: string): Promise<void> {
  await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
}

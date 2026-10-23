import type { Db } from './db'
import { PRESET_THEMES } from './presets'

const MIGRATIONS: ((db: Db) => Promise<void>)[] = [
  async (db) => {
    await db.exec(`
      CREATE TABLE books (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        filePath TEXT NOT NULL,
        coverPath TEXT,
        size INTEGER NOT NULL,
        locations TEXT,
        addedAt INTEGER NOT NULL,
        lastOpenedAt INTEGER
      );
      CREATE TABLE progress (
        bookId TEXT PRIMARY KEY NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        cfi TEXT NOT NULL,
        percent REAL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE themes (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        background TEXT NOT NULL,
        text TEXT NOT NULL,
        link TEXT NOT NULL,
        fontFamily TEXT NOT NULL,
        fontSize REAL NOT NULL,
        lineHeight REAL NOT NULL,
        margin REAL NOT NULL,
        builtin INTEGER NOT NULL
      );
      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `)
    for (const t of PRESET_THEMES) {
      await db.run(
        'INSERT INTO themes (id, name, background, text, link, fontFamily, fontSize, lineHeight, margin, builtin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [t.id, t.name, t.background, t.text, t.link, t.fontFamily, t.fontSize, t.lineHeight, t.margin],
      )
    }
  },
]

export async function migrate(db: Db): Promise<void> {
  // Vale por conexão, então a cada abertura, fora da transação.
  await db.exec('PRAGMA foreign_keys = ON')
  const row = await db.getFirst<{ user_version: number }>('PRAGMA user_version')
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    const step = MIGRATIONS[version]
    await db.transaction(async () => {
      await step(db)
      await db.exec(`PRAGMA user_version = ${version + 1}`)
    })
  }
}

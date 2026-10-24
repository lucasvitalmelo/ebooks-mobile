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
    for (const t of PRESET_THEMES.filter((preset) => preset.id !== 'preset-preto')) {
      await db.run(
        'INSERT INTO themes (id, name, background, text, link, fontFamily, fontSize, lineHeight, margin, builtin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [t.id, t.name, t.background, t.text, t.link, t.fontFamily, t.fontSize, t.lineHeight, t.margin],
      )
    }
  },
  async (db) => {
    await db.exec(`
      CREATE TABLE highlights (
        id TEXT PRIMARY KEY NOT NULL,
        bookId TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        cfiRange TEXT NOT NULL,
        text TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX highlights_book ON highlights(bookId);
    `)
  },
  async (db) => {
    await db.exec('ALTER TABLE highlights ADD COLUMN note TEXT')
    const preto = PRESET_THEMES.find((t) => t.id === 'preset-preto')!
    await db.run(
      `INSERT OR IGNORE INTO themes (id, name, background, text, link, fontFamily, fontSize, lineHeight, margin, builtin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        preto.id,
        preto.name,
        preto.background,
        preto.text,
        preto.link,
        preto.fontFamily,
        preto.fontSize,
        preto.lineHeight,
        preto.margin,
      ],
    )
  },
  async (db) => {
    // Livros importados antes desta versão não passaram pela limpeza do CSS: prepared = 0.
    await db.exec(`
      ALTER TABLE books ADD COLUMN fontScale REAL;
      ALTER TABLE books ADD COLUMN prepared INTEGER NOT NULL DEFAULT 0;
    `)
  },
  async (db) => {
    // Sincronização com o Drive (os mesmos carimbos do leitor web). Os livros
    // de antes começam com tudo na data da importação e esperando envio; o
    // progresso perde o NOT NULL do cfi porque o web grava progresso sem posição.
    await db.exec(`
      ALTER TABLE books ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE books ADD COLUMN fileUpdatedAt INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE books ADD COLUMN blobUpdatedAt INTEGER;
      ALTER TABLE books ADD COLUMN pendingUpload INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE books ADD COLUMN driveFileId TEXT;
      ALTER TABLE books ADD COLUMN driveCoverId TEXT;
      UPDATE books SET updatedAt = addedAt, fileUpdatedAt = addedAt, blobUpdatedAt = addedAt;

      ALTER TABLE highlights ADD COLUMN color TEXT NOT NULL DEFAULT '#fac73c';

      CREATE TABLE progress_new (
        bookId TEXT PRIMARY KEY NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        cfi TEXT,
        percent REAL,
        updatedAt INTEGER NOT NULL
      );
      INSERT INTO progress_new (bookId, cfi, percent, updatedAt) SELECT bookId, cfi, percent, updatedAt FROM progress;
      DROP TABLE progress;
      ALTER TABLE progress_new RENAME TO progress;

      CREATE TABLE deletions (
        key TEXT PRIMARY KEY NOT NULL,
        deletedAt INTEGER NOT NULL
      );
    `)
  },
]

export function migrate(db: Db): Promise<void> {
  return migrateTo(db, MIGRATIONS.length)
}

// Para os testes: aplica as migrações só até `target`.
export async function migrateTo(db: Db, target: number): Promise<void> {
  // Vale por conexão, então a cada abertura, fora da transação.
  await db.exec('PRAGMA foreign_keys = ON')
  const row = await db.getFirst<{ user_version: number }>('PRAGMA user_version')
  for (let version = row?.user_version ?? 0; version < Math.min(target, MIGRATIONS.length); version++) {
    const step = MIGRATIONS[version]
    await db.transaction(async () => {
      await step(db)
      await db.exec(`PRAGMA user_version = ${version + 1}`)
    })
  }
}

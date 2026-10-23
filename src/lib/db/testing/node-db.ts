import { DatabaseSync } from 'node:sqlite'
import type { Db, SqlValue } from '../db'

export function openTestDb(): Db {
  const db = new DatabaseSync(':memory:')
  return {
    async exec(sql) {
      db.exec(sql)
    },
    async run(sql, params: SqlValue[] = []) {
      const result = db.prepare(sql).run(...params)
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }
    },
    async getAll<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[]
    },
    async getFirst<T>(sql: string, params: SqlValue[] = []) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null
    },
    async transaction(fn) {
      db.exec('BEGIN')
      try {
        await fn()
        db.exec('COMMIT')
      } catch (error) {
        // Como o withTransactionAsync do expo-sqlite: se o SQLite já desfez sozinho,
        // o erro do ROLLBACK não pode esconder o original.
        try {
          db.exec('ROLLBACK')
        } catch {}
        throw error
      }
    },
  }
}

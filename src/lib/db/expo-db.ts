import type { SQLiteDatabase } from 'expo-sqlite'
import type { Db, SqlValue } from './db'

export function fromExpo(db: SQLiteDatabase): Db {
  return {
    exec: (sql) => db.execAsync(sql),
    async run(sql, params: SqlValue[] = []) {
      const result = await db.runAsync(sql, params)
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId }
    },
    getAll: <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    getFirst: <T>(sql: string, params: SqlValue[] = []) => db.getFirstAsync<T>(sql, params),
    transaction: (fn) => db.withTransactionAsync(fn),
  }
}

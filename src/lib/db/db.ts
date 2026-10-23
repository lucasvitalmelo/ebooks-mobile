export type SqlValue = string | number | null

export interface RunResult {
  changes: number
  lastInsertRowId: number
}

export interface Db {
  exec(sql: string): Promise<void>
  run(sql: string, params?: SqlValue[]): Promise<RunResult>
  getAll<T>(sql: string, params?: SqlValue[]): Promise<T[]>
  getFirst<T>(sql: string, params?: SqlValue[]): Promise<T | null>
  // Não isola de queries concorrentes: o que outra parte do app rodar durante o
  // await cai dentro da transação. Hoje só o migrate usa, antes da UI montar.
  transaction(fn: () => Promise<void>): Promise<void>
}

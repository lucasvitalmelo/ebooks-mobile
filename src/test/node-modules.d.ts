// Os testes rodam no Node, mas o @types/node inteiro poria os tipos de timer
// do Node por cima dos do React Native no app todo. Só o que os testes usam.
declare module 'fs' {
  export function readFileSync(path: string): Uint8Array
}

declare module 'node:sqlite' {
  export interface StatementSync {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint }
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
  }
  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): StatementSync
  }
}

declare const __dirname: string

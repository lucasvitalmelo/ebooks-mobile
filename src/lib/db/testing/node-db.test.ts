import { openTestDb } from './node-db'

test('node:sqlite roda dentro do Jest', async () => {
  const db = openTestDb()
  await db.exec('CREATE TABLE t (a TEXT)')
  const result = await db.run('INSERT INTO t (a) VALUES (?)', ['x'])
  expect(result).toEqual({ changes: 1, lastInsertRowId: 1 })
  expect(await db.getAll('SELECT a FROM t')).toEqual([{ a: 'x' }])
  expect(await db.getFirst('SELECT a FROM t WHERE a = ?', ['y'])).toBeNull()
})

test('transaction desfaz tudo quando falha', async () => {
  const db = openTestDb()
  await db.exec('CREATE TABLE t (a TEXT)')
  await expect(
    db.transaction(async () => {
      await db.run('INSERT INTO t (a) VALUES (?)', ['x'])
      throw new Error('falhou')
    }),
  ).rejects.toThrow('falhou')
  expect(await db.getAll('SELECT a FROM t')).toEqual([])
})

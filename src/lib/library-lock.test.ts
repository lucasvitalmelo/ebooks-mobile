import { withLibraryLock } from './library-lock'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

test('executa uma tarefa por vez, na ordem', async () => {
  const log: string[] = []
  const task = (name: string) =>
    withLibraryLock(async () => {
      log.push(`${name}:início`)
      await tick()
      log.push(`${name}:fim`)
      return name
    })
  expect(await Promise.all([task('a'), task('b'), task('c')])).toEqual(['a', 'b', 'c'])
  expect(log).toEqual(['a:início', 'a:fim', 'b:início', 'b:fim', 'c:início', 'c:fim'])
})

test('um erro rejeita só a própria tarefa e não trava a fila', async () => {
  const failing = withLibraryLock(async () => {
    throw new Error('falhou')
  })
  const next = withLibraryLock(async () => 'ok')
  await expect(failing).rejects.toThrow('falhou')
  await expect(next).resolves.toBe('ok')
  await expect(withLibraryLock(async () => 'depois')).resolves.toBe('depois')
})

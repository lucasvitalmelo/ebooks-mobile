import { pickContinue } from './library'

const row = (id: string, lastOpenedAt: number | null, percent: number | null) => ({ id, lastOpenedAt, percent })

test('o mais recente com leitura em andamento', () => {
  expect(pickContinue([row('a', 30, 1), row('b', 20, 0.4), row('c', 10, 0.2)])?.id).toBe('b')
})

test('sem leitura em andamento, o último aberto', () => {
  expect(pickContinue([row('a', 30, 1), row('b', null, null)])?.id).toBe('a')
})

test('nenhum aberto, nada', () => {
  expect(pickContinue([row('a', null, null)])).toBeNull()
  expect(pickContinue([])).toBeNull()
})

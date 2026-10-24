import { delayForReadingSync } from './reading-sync'

const NOW = 1_000_000_000

test('sem sincronização nesta sessão, espera só a pausa depois da gravação', () => {
  expect(delayForReadingSync(NOW, null)).toBe(15_000)
})

test('longe da última sincronização, espera só a pausa', () => {
  expect(delayForReadingSync(NOW, NOW - 10 * 60_000)).toBe(15_000)
  expect(delayForReadingSync(NOW, NOW - 180_000)).toBe(15_000)
})

test('perto da última sincronização, espera o intervalo terminar', () => {
  expect(delayForReadingSync(NOW, NOW - 60_000)).toBe(120_000)
  expect(delayForReadingSync(NOW, NOW)).toBe(180_000)
  // Faltando menos que a pausa, vale a pausa.
  expect(delayForReadingSync(NOW, NOW - 175_000)).toBe(15_000)
})

test('pausa e intervalo configuráveis', () => {
  expect(delayForReadingSync(NOW, NOW - 1_000, 500, 2_000)).toBe(1_000)
})

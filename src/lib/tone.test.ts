import { PRESET_THEMES } from '@/lib/db/presets'
import { isDark } from './tone'

test('classifica fundos escuros e claros', () => {
  expect(isDark('#1a1a1f')).toBe(true)
  expect(isDark('#000')).toBe(true)
  expect(isDark('#ffffff')).toBe(false)
  expect(isDark('#f4ecd8')).toBe(false)
})

test('todos os temas prontos: só o Escuro é escuro', () => {
  expect(PRESET_THEMES.filter((t) => isDark(t.background)).map((t) => t.id)).toEqual(['preset-escuro'])
})

test('cor inválida conta como clara', () => {
  expect(isDark('red')).toBe(false)
})

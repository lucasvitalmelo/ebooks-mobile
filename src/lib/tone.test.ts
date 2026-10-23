import { PRESET_THEMES } from '@/lib/db/presets'
import { chromeFor, isDark } from './tone'

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

test('chromeFor escolhe barra e texto legíveis', () => {
  expect(chromeFor('#1a1a1f')).toMatchObject({ statusBar: 'light', text: '#f4f4f5' })
  expect(chromeFor('#ffffff')).toMatchObject({ statusBar: 'dark', text: '#1f1f1f' })
})

test('chromeFor traz cor secundária e de capa vazia para os dois tons', () => {
  expect(chromeFor('#1a1a1f')).toMatchObject({ muted: '#a1a1aa', placeholder: 'rgba(255,255,255,0.08)' })
  expect(chromeFor('#ffffff')).toMatchObject({ muted: '#666666', placeholder: '#eeeeee' })
})

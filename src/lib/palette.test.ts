import { PRESET_THEMES } from '@/lib/db/presets'
import { paletteFor } from './palette'
import { contrastRatio, mixHex } from './theme-colors'

const claro = PRESET_THEMES.find((t) => t.id === 'preset-claro')!
const escuro = PRESET_THEMES.find((t) => t.id === 'preset-escuro')!

test('mistura o texto no fundo nas proporções do web', () => {
  const p = paletteFor(claro)
  expect(p.panel).toBe(mixHex(claro.text, claro.background, 0.05))
  expect(p.returnBg).toBe(mixHex(claro.text, claro.background, 0.08))
  expect(p.border).toBe(mixHex(claro.text, claro.background, 0.15))
  expect(p.panelBorder).toBe(mixHex(claro.text, claro.background, 0.2))
  expect(p.fill).toBe(mixHex(claro.text, claro.background, 0.6))
  expect(p.muted).toBe(mixHex(claro.text, claro.background, 0.7))
})

test('botão principal é a cor do texto com rótulo na cor do fundo', () => {
  expect(paletteFor(claro)).toMatchObject({ primary: claro.text, onPrimary: claro.background })
  expect(paletteFor(escuro)).toMatchObject({ primary: escuro.text, onPrimary: escuro.background })
})

test('barra de status e link legíveis', () => {
  expect(paletteFor(claro).statusBar).toBe('dark')
  expect(paletteFor(escuro).statusBar).toBe('light')
  for (const theme of PRESET_THEMES) {
    expect(contrastRatio(paletteFor(theme).link, theme.background)).toBeGreaterThanOrEqual(4.5)
  }
})

test('cor do grifo é a do web', () => {
  expect(paletteFor(claro).highlight).toBe('#fac73c')
})

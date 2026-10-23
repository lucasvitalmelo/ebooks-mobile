import { PRESET_THEMES } from '@/lib/db/presets'
import { contrastRatio, linkColor, mixHex } from './theme-colors'

const target = (text: string, background: string) => Math.max(4.5, Math.min(7, contrastRatio(text, background)))
const isBluish = (hex: string) => parseInt(hex.slice(5, 7), 16) > parseInt(hex.slice(1, 3), 16)

describe('contrastRatio', () => {
  it('bate com os valores conhecidos do WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#0000ee', '#1a1a1f')).toBeCloseTo(1.84, 1)
  })
})

describe('mixHex', () => {
  it('mistura em proporção', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#123456', '#ffffff', 1)).toBe('#123456')
  })
})

describe('linkColor', () => {
  it.each(PRESET_THEMES.map((theme) => [theme.name, theme] as const))(
    '%s: azul com o contraste do alvo contra o fundo',
    (_, theme) => {
      const color = linkColor(theme)
      expect(color).toMatch(/^#[0-9a-f]{6}$/)
      expect(isBluish(color)).toBe(true)
      expect(contrastRatio(color, theme.background)).toBeGreaterThanOrEqual(target(theme.text, theme.background) - 0.01)
    },
  )

  it('no Escuro sai claro (o problema que motivou isto)', () => {
    const escuro = PRESET_THEMES.find((theme) => theme.id === 'preset-escuro')!
    expect(contrastRatio(linkColor(escuro), escuro.background)).toBeGreaterThan(6.9)
  })

  it.each([
    ['preto/branco', { text: '#ffffff', background: '#000000' }],
    ['azul-noite', { text: '#ffffff', background: '#0b1e3a' }],
    ['cinza sobre cinza escuro', { text: '#9a9a9a', background: '#2b2b2b' }],
    ['texto marrom', { text: '#5a3b00', background: '#fdf6e3' }],
  ])('personalizado %s: passa do alvo ou volta para a cor do texto', (_, theme) => {
    const color = linkColor(theme)
    if (color !== theme.text) {
      expect(contrastRatio(color, theme.background)).toBeGreaterThanOrEqual(target(theme.text, theme.background) - 0.01)
    }
  })

  it('sem contraste mínimo possível, usa a cor do texto', () => {
    expect(linkColor({ text: '#777777', background: '#888888' })).toBe('#777777')
  })
})

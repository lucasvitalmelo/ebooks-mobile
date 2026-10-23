// Luminância relativa (WCAG) de um #rgb/#rrggbb; cor que não é hex conta como clara.
function luminance(color: string): number {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1]
  if (!hex) return 1
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function isDark(background: string): boolean {
  return luminance(background) < 0.18
}

export interface Chrome {
  statusBar: 'light' | 'dark'
  text: string
  surface: string
  control: string
  border: string
}

// Cores da barra e da folha de aparência (que ficam fora da página do livro) para o fundo do tema.
export function chromeFor(background: string): Chrome {
  return isDark(background)
    ? {
        statusBar: 'light',
        text: '#f4f4f5',
        surface: 'rgba(32,32,38,0.96)',
        control: 'rgba(255,255,255,0.14)',
        border: 'rgba(255,255,255,0.22)',
      }
    : {
        statusBar: 'dark',
        text: '#1f1f1f',
        surface: 'rgba(255,255,255,0.96)',
        control: '#f0e6ff',
        border: '#dddddd',
      }
}

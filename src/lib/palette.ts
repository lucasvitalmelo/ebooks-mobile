import { linkColor, mixHex, type Colors } from './theme-colors'
import { isDark } from './tone'

export interface Palette {
  background: string
  text: string
  muted: string
  panel: string
  returnBg: string
  border: string
  panelBorder: string
  track: string
  fill: string
  primary: string
  onPrimary: string
  link: string
  highlight: string
  statusBar: 'light' | 'dark'
}

export const HIGHLIGHT_COLOR = '#fac73c'

// Como no leitor web: a interface inteira sai do tema ativo, com a cor do texto
// misturada no fundo (opaca, para não pegar o que estiver por baixo).
export function paletteFor({ text, background }: Colors): Palette {
  const tint = (weight: number) => mixHex(text, background, weight)
  return {
    background,
    text,
    muted: tint(0.7),
    panel: tint(0.05),
    returnBg: tint(0.08),
    border: tint(0.15),
    panelBorder: tint(0.2),
    track: tint(0.15),
    fill: tint(0.6),
    primary: text,
    onPrimary: background,
    link: linkColor({ text, background }),
    highlight: HIGHLIGHT_COLOR,
    statusBar: isDark(background) ? 'light' : 'dark',
  }
}

import { fontCss } from './fonts'
import type { ReaderTheme } from './theme'

// CSS do tema dentro de cada capítulo. O CSS do livro costuma pôr line-height
// direto nos elementos, o que vence um valor herdado do body; só mirando neles
// a entrelinha muda.
export function themeCss(t: ReaderTheme): string {
  return [
    `body { background: ${t.background} !important; color: ${t.text} !important; font-family: ${fontCss(t.fontFamily)} !important; }`,
    `p, li, blockquote, div, span, td { line-height: ${t.lineHeight} !important; }`,
    `a { color: ${t.link} !important; }`,
  ].join('\n')
}

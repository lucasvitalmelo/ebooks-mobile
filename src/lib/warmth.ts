// Um filtro âmbar por cima da tela, como a luz noturna do sistema: não muda as
// cores do tema, só esquenta tudo o que aparece.
export const WARMTH_COLOR = 'rgb(255,138,0)'
const MAX_OPACITY = 0.35

export function warmthOpacity(percent: number): number {
  return (Math.min(100, Math.max(0, percent)) / 100) * MAX_OPACITY
}

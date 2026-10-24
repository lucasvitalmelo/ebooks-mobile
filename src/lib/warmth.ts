// A cor multiplicada sobre a tela, como o Modo Noturno do sistema: tira azul e um
// pouco de verde. Multiplicar mantém o preto preto (a camada âmbar de antes o
// clareava) e o texto escuro continua escuro.
const MAX_GREEN_CUT = 0.22
const MAX_BLUE_CUT = 0.5

const amountOf = (percent: number) => Math.min(100, Math.max(0, percent)) / 100

export function warmthColor(percent: number): string {
  const amount = amountOf(percent)
  const green = Math.round(255 * (1 - MAX_GREEN_CUT * amount))
  const blue = Math.round(255 * (1 - MAX_BLUE_CUT * amount))
  return `rgb(255,${green},${blue})`
}

// Abaixo do Android 10 o mixBlendMode é ignorado e a cor multiplicada pintaria a
// tela inteira: lá fica a camada âmbar translúcida de antes.
export const LEGACY_WARMTH_COLOR = 'rgb(255,138,0)'
const LEGACY_MAX_OPACITY = 0.35

export function legacyWarmthOpacity(percent: number): number {
  return amountOf(percent) * LEGACY_MAX_OPACITY
}

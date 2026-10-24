// Abaixo deste valor a janela já está no mínimo do aparelho e o resto do
// escurecimento vem de uma camada preta: dá para ler no escuro abaixo do
// mínimo do sistema.
export const DIM_BELOW = 10
const MIN_WINDOW = 0.02
const MAX_DIM = 0.5

export interface BrightnessLevels {
  // Brilho da janela do app, de 0 a 1 (expo-brightness).
  window: number
  // Opacidade da camada preta por cima da tela.
  dim: number
}

export function brightnessLevels(percent: number): BrightnessLevels {
  const value = Math.min(100, Math.max(0, percent))
  if (value >= DIM_BELOW) return { window: value / 100, dim: 0 }
  return { window: MIN_WINDOW, dim: Math.round(((DIM_BELOW - value) / DIM_BELOW) * MAX_DIM * 100) / 100 }
}

export type Gesture = 'next' | 'prev' | 'centerTap' | null

const SWIPE_MIN = 40
const TAP_MAX = 10
const LONG_PRESS_MS = 500
const EDGE = 0.3

// dx/dy: deslocamento do dedo; x: onde o dedo saiu, na largura da tela;
// duration: quanto tempo o dedo ficou na tela (parado e demorado é seleção de texto, não toque).
export function classifyGesture({
  dx,
  dy,
  x,
  width,
  duration,
}: {
  dx: number
  dy: number
  x: number
  width: number
  duration: number
}): Gesture {
  if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'next' : 'prev'
  if (Math.abs(dx) <= TAP_MAX && Math.abs(dy) <= TAP_MAX && duration <= LONG_PRESS_MS) {
    if (x < width * EDGE) return 'prev'
    if (x > width * (1 - EDGE)) return 'next'
    return 'centerTap'
  }
  return null
}

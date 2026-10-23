export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

// slop: o dedo não acerta a borda do retângulo com precisão de pixel.
export function hitHighlight(x: number, y: number, items: { id: string; rects: Rect[] }[], slop = 4): string | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const hit = items[i].rects.some(
      (r) => x >= r.left - slop && x <= r.right + slop && y >= r.top - slop && y <= r.bottom + slop,
    )
    if (hit) return items[i].id
  }
  return null
}

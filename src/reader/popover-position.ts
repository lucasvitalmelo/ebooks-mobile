export interface Box {
  top: number
  bottom: number
  left: number
  right: number
}

export interface PopoverPlacement {
  top: number
  left: number
  side: 'below' | 'above'
}

// O que as alças de seleção do sistema ocupam abaixo do texto.
export const HANDLE_ROOM = 28
const GAP = 8
const EDGE = 8

// Onde fica um cartão de tamanho `size` para o texto que ocupa `text` (coordenadas
// da tela): centralizado embaixo, depois das alças; em cima quando não há espaço
// embaixo; sempre dentro da tela na horizontal.
export function placePopover(
  text: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  handleRoom = HANDLE_ROOM,
): PopoverPlacement {
  const centre = (text.left + text.right) / 2
  const left = Math.min(Math.max(centre - size.width / 2, EDGE), Math.max(viewport.width - size.width - EDGE, EDGE))
  const below = text.bottom + handleRoom + GAP
  if (below + size.height <= viewport.height - EDGE) return { top: below, left, side: 'below' }
  const above = text.top - size.height - GAP
  if (above >= EDGE) return { top: above, left, side: 'above' }
  // Nenhum lado cabe (seleção alta): mantém na tela, por cima do texto.
  const top = Math.min(Math.max(below, EDGE), Math.max(viewport.height - size.height - EDGE, EDGE))
  return { top, left, side: 'below' }
}

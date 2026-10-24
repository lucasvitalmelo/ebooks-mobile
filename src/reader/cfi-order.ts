// Os números do começo de um CFI, em ordem: passo do spine, caminho dentro do
// capítulo, deslocamento em caracteres. Asserções de id ([...]) e deslocamentos
// temporais ou espaciais (~, @) não contam para a ordem. Um intervalo
// (base,início,fim) começa em base + início.
export function cfiSteps(cfi: string): number[] {
  const body = cfi.replace(/^epubcfi\(/, '').replace(/\)$/, '')
  const [base, start = ''] = body.split(',')
  return (base + start)
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[~@][^/!:,]*/g, '')
    .split(/[/!:]/)
    .filter((part) => part !== '')
    .map(Number)
    .filter((step) => Number.isFinite(step))
}

// Negativo quando a vem antes no livro, positivo quando b vem antes, 0 quando
// começam no mesmo lugar.
export function compareCfi(a: string, b: string): number {
  const x = cfiSteps(a)
  const y = cfiSteps(b)
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i] - y[i]
  }
  return x.length - y.length
}

export function byBookOrder<T extends { cfiRange: string; createdAt: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareCfi(a.cfiRange, b.cfiRange) || a.createdAt - b.createdAt)
}

// Sem o fim da página (ainda não veio), só o próprio começo conta como "na tela".
export function containsCfi(start: string, end: string | null, cfi: string): boolean {
  if (!end) return compareCfi(cfi, start) === 0
  return compareCfi(cfi, start) >= 0 && compareCfi(cfi, end) <= 0
}

// A página na tela ainda mostra a posição salva (o persistIfMoved do web): ao
// abrir, ou num relayout, gravar de novo só carimbaria a mesma posição com a
// hora de agora, e ela venceria um progresso mais novo de outro aparelho.
export function showsSaved(
  saved: string | null,
  page: { cfi: string; startCfi: string | null; endCfi: string | null },
): boolean {
  return saved !== null && containsCfi(page.startCfi ?? page.cfi, page.endCfi, saved)
}

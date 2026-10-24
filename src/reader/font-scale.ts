export interface FontSample {
  fontSize: number
  chars: number
}

// O tema força o tamanho no <body>, descartando o tamanho próprio do livro — e
// livros cujos tamanhos de texto são encadeados a partir dele (body 1,29em × p
// 0,58em) ficam menores que o escolhido no leitor. Este é o fator que devolve o
// tamanho de texto mais comum ao tamanho do body.
export function fontScaleFor(samples: FontSample[], referencePx: number): number {
  const charsBySize = new Map<number, number>()
  for (const { fontSize, chars } of samples) {
    const size = Math.round(fontSize)
    charsBySize.set(size, (charsBySize.get(size) ?? 0) + chars)
  }
  let dominant = 0
  let most = 0
  for (const [size, chars] of charsBySize) {
    if (chars > most) [dominant, most] = [size, chars]
  }
  if (!dominant) return 1
  const ratio = dominant / referencePx
  if (ratio < 0.5 || ratio > 2 || Math.abs(ratio - 1) < 0.05) return 1
  return Math.round((referencePx / dominant) * 1000) / 1000
}

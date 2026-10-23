// O Hermes não tem TextDecoder (e o TextEncoder não é garantido em todas as
// versões), e os nomes das entradas do zip precisam virar texto igual ao que o
// leitor web lê, para o ID do livro bater.
export function encodeUtf8(text: string): Uint8Array {
  const out: number[] = []
  for (const char of text) {
    const cp = char.codePointAt(0)!
    if (cp < 0x80) out.push(cp)
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
  }
  return Uint8Array.from(out)
}

// Segue o algoritmo do TextDecoder do WHATWG (modo de substituição): cada
// subsequência inválida máxima vira um U+FFFD. Zips feitos no Windows guardam
// nomes em CP437/latin1, e o ID do livro tem que sair igual ao do leitor web
// mesmo nesses casos.
export function decodeUtf8(bytes: Uint8Array): string {
  const parts: string[] = []
  let codePoint = 0
  let needed = 0
  let seen = 0
  let lower = 0x80
  let upper = 0xbf
  let i = 0
  while (i < bytes.length) {
    const b = bytes[i]
    if (needed === 0) {
      i++
      if (b < 0x80) parts.push(String.fromCharCode(b))
      else if (b >= 0xc2 && b <= 0xdf) {
        needed = 1
        codePoint = b & 0x1f
      } else if (b >= 0xe0 && b <= 0xef) {
        if (b === 0xe0) lower = 0xa0
        if (b === 0xed) upper = 0x9f
        needed = 2
        codePoint = b & 0x0f
      } else if (b >= 0xf0 && b <= 0xf4) {
        if (b === 0xf0) lower = 0x90
        if (b === 0xf4) upper = 0x8f
        needed = 3
        codePoint = b & 0x07
      } else parts.push('�')
      continue
    }
    if (b < lower || b > upper) {
      // Não consome o byte: ele pode iniciar outro caractere.
      codePoint = needed = seen = 0
      lower = 0x80
      upper = 0xbf
      parts.push('�')
      continue
    }
    i++
    lower = 0x80
    upper = 0xbf
    codePoint = (codePoint << 6) | (b & 0x3f)
    if (++seen === needed) {
      parts.push(String.fromCodePoint(codePoint))
      codePoint = needed = seen = 0
    }
  }
  if (needed !== 0) parts.push('�')
  return parts.join('')
}

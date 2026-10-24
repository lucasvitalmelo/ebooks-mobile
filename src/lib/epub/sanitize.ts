// As folhas de estilo dos livros brigam com o tema do leitor de um jeito que só o
// body não resolve: a `color` de uma classe vence a cor herdada do tema, e um
// `white-space: pre-wrap` num contêiner transforma a indentação do HTML em
// linhas em branco. Só as folhas de estilo são reescritas, nunca o HTML dos
// capítulos, então os CFIs (posição de leitura, grifos) continuam válidos.

// Blocos `seletor { declarações }` mais internos — inclusive os dentro de @media.
const BLOCK = /([^{}]*)\{([^{}]*)\}/g
const COMMENT = /\/\*[\s\S]*?\*\//g
const PRE_SELECTOR = /(^|[\s>+~,(])(pre|code)\b/i

export function sanitizeCss(css: string): string {
  let changed = false
  const out = css.replace(COMMENT, '').replace(BLOCK, (block, selector: string, body: string) => {
    const keepPre = PRE_SELECTOR.test(selector)
    const declarations = splitDeclarations(body)
    const kept = declarations.filter((declaration) => !shouldDrop(declaration, keepPre))
    if (kept.length === declarations.length) return block
    changed = true
    return `${selector}{${kept.join(';')}}`
  })
  return changed ? out : css
}

function shouldDrop(declaration: string, keepPre: boolean): boolean {
  const colon = declaration.indexOf(':')
  if (colon < 0) return false
  const property = declaration.slice(0, colon).trim().toLowerCase()
  const value = declaration
    .slice(colon + 1)
    .trim()
    .toLowerCase()
  if (property === 'color' || property === 'background-color') return true
  if (property === 'background') return !value.includes('url(')
  if (property === 'white-space') return !keepPre && /^(pre|break-spaces)/.test(value)
  return false
}

// `;` dentro de url(...) ou aspas (data URI: `;base64,`) não é separador.
function splitDeclarations(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (quote) {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") quote = char
    else if (char === '(') depth++
    else if (char === ')') depth = Math.max(0, depth - 1)
    else if (char === ';' && depth === 0) {
      parts.push(body.slice(start, i))
      start = i + 1
    }
  }
  parts.push(body.slice(start))
  return parts
}

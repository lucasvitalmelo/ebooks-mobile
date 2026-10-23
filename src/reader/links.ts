import { isExternalUrl } from './protocol'

export type LinkTarget = { kind: 'external'; url: string } | { kind: 'internal'; path: string; hash: string }

// Origem fictícia: só serve para o URL resolver caminhos relativos ao capítulo.
const BASE = 'https://livro.invalid'

export function resolveLink(raw: string, sectionPath: string): LinkTarget | null {
  const href = raw.trim()
  if (!href) return null
  if (isExternalUrl(href)) return { kind: 'external', url: href }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null
  try {
    const url = new URL(href, `${BASE}${sectionPath.startsWith('/') ? '' : '/'}${sectionPath}`)
    if (url.origin !== BASE) return null
    return { kind: 'internal', path: decodeURIComponent(url.pathname), hash: url.hash }
  } catch {
    return null
  }
}

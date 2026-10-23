import { isFontId } from './fonts'
import type { Rect } from './hit'
import type { ReaderTheme } from './theme'

import type { TocEntry } from './toc'

export interface HighlightRef {
  id: string
  cfiRange: string
}

export type Command =
  | { type: 'open'; base64: string; cfi: string | null; locations: string | null; highlights: HighlightRef[] }
  | { type: 'next' }
  | { type: 'prev' }
  // CFI (epubcfi(...)) ou href de capítulo, como vem do sumário.
  | { type: 'goTo'; target: string }
  | { type: 'setTheme'; theme: ReaderTheme }
  | { type: 'addHighlight'; id: string; cfiRange: string }
  | { type: 'removeHighlight'; id: string }
  | { type: 'clearSelection' }

export type ReaderEvent =
  | { type: 'ready' }
  | {
      type: 'relocated'
      cfi: string
      percent: number | null
      href: string | null
      // Começo e fim da página na tela; `cfi` é a âncora, que pode estar no meio dela.
      startCfi: string | null
      endCfi: string | null
    }
  | { type: 'locations'; data: string }
  | { type: 'centerTap' }
  | { type: 'openExternal'; url: string }
  | { type: 'toc'; entries: TocEntry[] }
  | { type: 'selection'; cfiRange: string | null; text: string; rect: Rect | null }
  | { type: 'highlightTap'; id: string; rect: Rect }
  | { type: 'linkJump' }
  | { type: 'jumpEnded'; ok: boolean }
  | { type: 'error'; message: string }

type Fields = Record<string, unknown>

const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isInteger = (value: unknown): value is number => Number.isInteger(value)
const isNullableString = (value: unknown): value is string | null => value === null || isString(value)

function isRect(value: unknown): value is Rect {
  if (!value || typeof value !== 'object') return false
  const r = value as Fields
  return isNumber(r.left) && isNumber(r.top) && isNumber(r.right) && isNumber(r.bottom)
}
const pickRect = ({ left, top, right, bottom }: Rect): Rect => ({ left, top, right, bottom })

// Só o que faz sentido abrir fora do app; nada de javascript:, file: ou links internos do livro.
export function isExternalUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(url)
}

function parseObject(raw: string): Fields | null {
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : null
  } catch {
    return null
  }
}

export function isReaderTheme(value: unknown): value is ReaderTheme {
  if (!value || typeof value !== 'object') return false
  const t = value as Fields
  return (
    isString(t.background) &&
    isString(t.text) &&
    isString(t.link) &&
    isFontId(t.fontFamily) &&
    isNumber(t.fontSize) &&
    isNumber(t.lineHeight) &&
    isNumber(t.margin)
  )
}

function pickTheme(t: ReaderTheme): ReaderTheme {
  const { background, text, link, fontFamily, fontSize, lineHeight, margin } = t
  return { background, text, link, fontFamily, fontSize, lineHeight, margin }
}

const isFilled = (value: unknown): value is string => isString(value) && value.length > 0

function isHighlightRef(value: unknown): value is HighlightRef {
  if (!value || typeof value !== 'object') return false
  const h = value as Fields
  return isFilled(h.id) && isFilled(h.cfiRange)
}

function isTocEntry(value: unknown): value is TocEntry {
  if (!value || typeof value !== 'object') return false
  const e = value as Fields
  return isString(e.label) && isString(e.href) && isInteger(e.depth) && e.depth >= 0
}

const arrayOf =
  <T>(check: (value: unknown) => value is T) =>
  (value: unknown): value is T[] =>
    Array.isArray(value) && value.every(check)

const isHighlightRefs = arrayOf(isHighlightRef)
const isTocEntries = arrayOf(isTocEntry)

export function parseCommand(raw: string): Command | null {
  const m = parseObject(raw)
  if (!m) return null
  switch (m.type) {
    case 'open':
      return isString(m.base64) &&
        isNullableString(m.cfi) &&
        isNullableString(m.locations) &&
        isHighlightRefs(m.highlights)
        ? {
            type: 'open',
            base64: m.base64,
            cfi: m.cfi,
            locations: m.locations,
            highlights: m.highlights.map(({ id, cfiRange }) => ({ id, cfiRange })),
          }
        : null
    case 'next':
    case 'prev':
    case 'clearSelection':
      return { type: m.type }
    case 'goTo':
      return isFilled(m.target) ? { type: 'goTo', target: m.target } : null
    case 'setTheme':
      return isReaderTheme(m.theme) ? { type: 'setTheme', theme: pickTheme(m.theme) } : null
    case 'addHighlight':
      return isFilled(m.id) && isFilled(m.cfiRange) ? { type: 'addHighlight', id: m.id, cfiRange: m.cfiRange } : null
    case 'removeHighlight':
      return isFilled(m.id) ? { type: 'removeHighlight', id: m.id } : null
    default:
      return null
  }
}

export function parseEvent(raw: string): ReaderEvent | null {
  const m = parseObject(raw)
  if (!m) return null
  switch (m.type) {
    case 'ready':
    case 'centerTap':
    case 'linkJump':
      return { type: m.type }
    case 'relocated':
      return isString(m.cfi) &&
        (m.percent === null || (isNumber(m.percent) && m.percent >= 0 && m.percent <= 1)) &&
        isNullableString(m.href) &&
        isNullableString(m.startCfi) &&
        isNullableString(m.endCfi)
        ? { type: 'relocated', cfi: m.cfi, percent: m.percent, href: m.href, startCfi: m.startCfi, endCfi: m.endCfi }
        : null
    case 'jumpEnded':
      return typeof m.ok === 'boolean' ? { type: 'jumpEnded', ok: m.ok } : null
    case 'locations':
      return isString(m.data) ? { type: 'locations', data: m.data } : null
    case 'openExternal':
      return isString(m.url) && isExternalUrl(m.url) ? { type: 'openExternal', url: m.url } : null
    case 'toc':
      return isTocEntries(m.entries)
        ? { type: 'toc', entries: m.entries.map(({ label, href, depth }) => ({ label, href, depth })) }
        : null
    case 'selection':
      return isNullableString(m.cfiRange) && isString(m.text) && (m.rect === null || isRect(m.rect))
        ? { type: 'selection', cfiRange: m.cfiRange, text: m.text, rect: m.rect === null ? null : pickRect(m.rect) }
        : null
    case 'highlightTap':
      return isFilled(m.id) && isRect(m.rect) ? { type: 'highlightTap', id: m.id, rect: pickRect(m.rect) } : null
    case 'error':
      return isString(m.message) ? { type: 'error', message: m.message } : null
    default:
      return null
  }
}

// O livro vai em base64 numa mensagem só; acima de alguns MB uma única chamada
// de injectJavaScript fica lenta ou falha. Pedaços menores, remontados na página.
export const CHUNK_SIZE = 512 * 1024
// Bem acima de um livro real (5 GB em pedaços de 512 KB); só barra lixo.
const MAX_CHUNKS = 10_000

export interface Chunk {
  id: number
  index: number
  total: number
  data: string
}

let nextId = 1

export function chunkMessage(message: string, size = CHUNK_SIZE): Chunk[] {
  const id = nextId++
  const total = Math.max(1, Math.ceil(message.length / size))
  return Array.from({ length: total }, (_, index) => ({
    id,
    index,
    total,
    data: message.slice(index * size, (index + 1) * size),
  }))
}

function isChunk(value: unknown): value is Chunk {
  if (!value || typeof value !== 'object') return false
  const c = value as Fields
  return (
    isInteger(c.id) &&
    isInteger(c.index) &&
    isInteger(c.total) &&
    isString(c.data) &&
    c.index >= 0 &&
    c.index < c.total &&
    c.total <= MAX_CHUNKS
  )
}

export class Assembler {
  private pending = new Map<number, { parts: string[]; received: number }>()

  push(raw: unknown): string | null {
    if (!isChunk(raw)) return null
    // Os pedaços de uma mensagem são enviados em sequência; se já chegou um id
    // mais novo, o que falta das anteriores não vem mais.
    for (const id of this.pending.keys()) if (id < raw.id) this.pending.delete(id)
    if (raw.total === 1) return raw.data
    const entry = this.pending.get(raw.id) ?? { parts: new Array<string>(raw.total), received: 0 }
    if (entry.parts[raw.index] === undefined) entry.received++
    entry.parts[raw.index] = raw.data
    this.pending.set(raw.id, entry)
    if (entry.received < raw.total) return null
    this.pending.delete(raw.id)
    return entry.parts.join('')
  }
}

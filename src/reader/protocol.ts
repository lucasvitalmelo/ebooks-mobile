import { isFontId } from './fonts'
import type { ReaderTheme } from './theme'

export type Command =
  | { type: 'open'; base64: string; cfi: string | null; locations: string | null }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goTo'; cfi: string }
  | { type: 'setTheme'; theme: ReaderTheme }

export type ReaderEvent =
  | { type: 'ready' }
  | { type: 'relocated'; cfi: string; percent: number | null }
  | { type: 'locations'; data: string }
  | { type: 'centerTap' }
  | { type: 'openExternal'; url: string }
  | { type: 'error'; message: string }

type Fields = Record<string, unknown>

const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isInteger = (value: unknown): value is number => Number.isInteger(value)
const isNullableString = (value: unknown): value is string | null => value === null || isString(value)

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

export function parseCommand(raw: string): Command | null {
  const m = parseObject(raw)
  if (!m) return null
  switch (m.type) {
    case 'open':
      return isString(m.base64) && isNullableString(m.cfi) && isNullableString(m.locations)
        ? { type: 'open', base64: m.base64, cfi: m.cfi, locations: m.locations }
        : null
    case 'next':
    case 'prev':
      return { type: m.type }
    case 'goTo':
      return isString(m.cfi) ? { type: 'goTo', cfi: m.cfi } : null
    case 'setTheme':
      return isReaderTheme(m.theme) ? { type: 'setTheme', theme: pickTheme(m.theme) } : null
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
      return { type: m.type }
    case 'relocated':
      return isString(m.cfi) && (m.percent === null || (isNumber(m.percent) && m.percent >= 0 && m.percent <= 1))
        ? { type: 'relocated', cfi: m.cfi, percent: m.percent }
        : null
    case 'locations':
      return isString(m.data) ? { type: 'locations', data: m.data } : null
    case 'openExternal':
      return isString(m.url) && isExternalUrl(m.url) ? { type: 'openExternal', url: m.url } : null
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

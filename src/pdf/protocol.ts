import type { Line, OutlineEntry, PageText } from '../lib/pdf/layout'

export interface PdfResult {
  title: string | null
  author: string | null
  // Data de modificação do PDF (ISO, sem milissegundos), ou null.
  modified: string | null
  pages: PageText[]
  outline: OutlineEntry[]
  // JPEG da primeira página, em base64, ou null.
  cover: string | null
}

export type PdfCommand = { type: 'convert'; id: number; base64: string }

export type PdfEvent =
  | { type: 'ready' }
  | { type: 'progress'; id: number; page: number; total: number }
  // O texto vai página a página (um PDF grande numa mensagem só estoura a ponte); o resultado final só leva o resto.
  | { type: 'pageText'; id: number; index: number; lines: Line[] }
  | ({ type: 'pdfResult'; id: number; pageCount: number } & Omit<PdfResult, 'pages'>)
  | { type: 'pdfError'; id: number; message: string }

type Fields = Record<string, unknown>
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isNullableString = (v: unknown): v is string | null => v === null || isString(v)
const isObject = (v: unknown): v is Fields => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

function parse(raw: string): Fields | null {
  try {
    const value: unknown = JSON.parse(raw)
    return isObject(value) ? value : null
  } catch {
    return null
  }
}

const isLine = (v: unknown) => isObject(v) && isString(v.text) && isNumber(v.top) && isNumber(v.height)
const isOutline = (v: unknown) => isObject(v) && isString(v.title) && Number.isInteger(v.pageIndex)

export function parsePdfCommand(raw: string): PdfCommand | null {
  const m = parse(raw)
  return m && m.type === 'convert' && Number.isInteger(m.id) && isString(m.base64)
    ? { type: 'convert', id: m.id as number, base64: m.base64 }
    : null
}

export function parsePdfEvent(raw: string): PdfEvent | null {
  const m = parse(raw)
  if (!m) return null
  switch (m.type) {
    case 'ready':
      return { type: 'ready' }
    case 'progress':
      return Number.isInteger(m.id) && isNumber(m.page) && isNumber(m.total)
        ? { type: 'progress', id: m.id as number, page: m.page, total: m.total }
        : null
    case 'pageText':
      return Number.isInteger(m.id) && Number.isInteger(m.index) && Array.isArray(m.lines) && m.lines.every(isLine)
        ? { type: 'pageText', id: m.id as number, index: m.index as number, lines: m.lines as Line[] }
        : null
    case 'pdfResult':
      return Number.isInteger(m.id) &&
        Number.isInteger(m.pageCount) &&
        isNullableString(m.title) &&
        isNullableString(m.author) &&
        isNullableString(m.modified) &&
        Array.isArray(m.outline) &&
        m.outline.every(isOutline) &&
        isNullableString(m.cover)
        ? {
            type: 'pdfResult',
            id: m.id as number,
            pageCount: m.pageCount as number,
            title: m.title,
            author: m.author,
            modified: m.modified,
            outline: m.outline as OutlineEntry[],
            cover: m.cover,
          }
        : null
    case 'pdfError':
      return Number.isInteger(m.id) && isString(m.message)
        ? { type: 'pdfError', id: m.id as number, message: m.message }
        : null
    default:
      return null
  }
}

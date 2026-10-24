// Build "legacy": traz os polyfills (Map.getOrInsertComputed, Math.sumPrecise...) que um Android System WebView antigo não tem.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import type { Line, OutlineEntry } from '../../src/lib/pdf/layout'
import { parsePdfCommand, type PdfEvent } from '../../src/pdf/protocol'
import { Assembler } from '../../src/reader/protocol'

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(data: string): void }
    __rnReceive?: (chunk: unknown) => void
    pdfjsWorker?: unknown
  }
}

// Sem arquivo de worker separado (a página é um HTML só): o pdf.js roda o worker
// na própria página quando encontra globalThis.pdfjsWorker.
window.pdfjsWorker = pdfjsWorker

const COVER_WIDTH = 1000
const LINE_TOLERANCE = 0.5

function send(event: PdfEvent) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(event))
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

interface TextItem {
  str?: string
  transform: number[]
  height: number
}

// Itens de texto → linhas: mesma altura na página (com tolerância) = mesma linha.
function linesOf(items: TextItem[], pageHeight: number): Line[] {
  const rows: { top: number; height: number; parts: { x: number; text: string }[] }[] = []
  for (const item of items) {
    if (!item.str) continue
    const top = pageHeight - item.transform[5]
    const height = item.height || Math.abs(item.transform[3]) || 10
    const row = rows.find((r) => Math.abs(r.top - top) <= height * LINE_TOLERANCE)
    if (row) row.parts.push({ x: item.transform[4], text: item.str })
    else rows.push({ top, height, parts: [{ x: item.transform[4], text: item.str }] })
  }
  return rows
    .sort((a, b) => a.top - b.top)
    .map((row) => ({
      top: row.top,
      height: row.height,
      text: row.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.text)
        .join('')
        .replace(/\s+/g, ' ')
        .trim(),
    }))
    .filter((line) => line.text)
}

async function outlineOf(doc: pdfjs.PDFDocumentProxy): Promise<OutlineEntry[]> {
  const outline = await doc.getOutline().catch(() => null)
  if (!outline) return []
  const entries: OutlineEntry[] = []
  for (const item of outline) {
    try {
      const dest = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest
      const ref = dest?.[0]
      if (!ref) continue
      const pageIndex = typeof ref === 'number' ? ref : await doc.getPageIndex(ref)
      entries.push({ title: item.title, pageIndex })
    } catch {
      // Destino que não resolve: o capítulo some do sumário, o texto fica.
    }
  }
  return entries
}

async function coverOf(doc: pdfjs.PDFDocumentProxy): Promise<string | null> {
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: COVER_WIDTH / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    // O pdf.js pinta o fundo de branco antes de desenhar a página.
    await page.render({ canvas, viewport }).promise
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? null
  } catch {
    return null
  }
}

async function convert(id: number, base64: string) {
  // No pdf.js 6 quem libera o documento é a tarefa de carregamento (o documento não tem mais destroy).
  const task = pdfjs.getDocument({ data: base64ToBytes(base64) })
  try {
    await read(id, await task.promise)
  } finally {
    await task.destroy()
  }
}

// "D:20200102030405+03'00'" → "2020-01-02T03:04:05Z" (o fuso é ignorado: só precisa ser estável).
function isoDate(raw: string | undefined): string | null {
  const m = raw?.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/)
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}:${m[6] ?? '00'}Z` : null
}

async function read(id: number, doc: pdfjs.PDFDocumentProxy) {
  const meta = await doc.getMetadata().catch(() => null)
  const info = (meta?.info ?? {}) as { Title?: string; Author?: string; ModDate?: string }
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    send({ type: 'pageText', id, index: n - 1, lines: linesOf(content.items as TextItem[], viewport.height) })
    page.cleanup()
    send({ type: 'progress', id, page: n, total: doc.numPages })
  }
  send({
    type: 'pdfResult',
    id,
    pageCount: doc.numPages,
    title: info.Title?.trim() || null,
    author: info.Author?.trim() || null,
    modified: isoDate(info.ModDate),
    outline: await outlineOf(doc),
    cover: await coverOf(doc),
  })
}

const assembler = new Assembler()
window.__rnReceive = (chunk) => {
  const raw = assembler.push(chunk)
  if (raw === null) return
  const command = parsePdfCommand(raw)
  if (!command) return
  convert(command.id, command.base64).catch((error: unknown) =>
    send({ type: 'pdfError', id: command.id, message: error instanceof Error ? error.message : String(error) }),
  )
}

send({ type: 'ready' })

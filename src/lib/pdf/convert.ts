import type { PdfResult } from '@/pdf/protocol'
import { buildEpub } from '../epub/build'
import { InvalidEpubError } from '../epub/parse'
import { chapters, dropRunningLines } from './layout'

const MIN_TEXT = 100

export class PdfWithoutTextError extends InvalidEpubError {
  constructor() {
    super('Este PDF não tem texto para converter (é só imagem).')
  }
}

// O base64 da capa vem da WebView (canvas.toDataURL); o RN não tem atob garantido no Hermes.
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let bits = 0
  let value = 0
  let index = 0
  for (const char of clean) {
    value = (value << 6) | table.indexOf(char)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[index++] = (value >> bits) & 0xff
    }
  }
  return out.subarray(0, index)
}

// `identifier` e `modified` precisam ser estáveis para o mesmo PDF: eles entram no OPF e,
// portanto, no ID do livro (o mesmo PDF importado duas vezes tem que ser uma duplicata).
export async function pdfToEpub(
  result: PdfResult,
  fileName: string,
  identifier: string,
  modified: string,
): Promise<Uint8Array> {
  const text = result.pages.reduce((sum, page) => sum + page.lines.reduce((n, l) => n + l.text.trim().length, 0), 0)
  if (text < MIN_TEXT) throw new PdfWithoutTextError()
  const parts = chapters(dropRunningLines(result.pages), result.outline)
  if (!parts.length) throw new PdfWithoutTextError()
  return buildEpub({
    identifier,
    modified,
    title: result.title?.trim() || fileName.replace(/\.pdf$/i, ''),
    author: result.author?.trim() ?? '',
    language: 'pt-BR',
    chapters: parts,
    cover: result.cover ? { bytes: base64ToBytes(result.cover), extension: 'jpg' } : null,
  })
}

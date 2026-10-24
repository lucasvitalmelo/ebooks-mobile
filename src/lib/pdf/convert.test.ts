import { bookIdFor } from '../epub/book-id'
import { parseEpub } from '../epub/parse'
import { base64ToBytes, PdfWithoutTextError, pdfToEpub } from './convert'
import type { PdfResult } from '@/pdf/protocol'

const MODIFIED = '2000-01-01T00:00:00Z'
const page = (text: string) => ({ lines: [{ text, top: 30, height: 10 }] })
const result = (pages: PdfResult['pages'], extra: Partial<PdfResult> = {}): PdfResult => ({
  title: null,
  author: null,
  modified: null,
  pages,
  outline: [],
  cover: null,
  ...extra,
})

const long = 'Um texto bem comprido para passar do mínimo de caracteres de um PDF com texto de verdade. '.repeat(3)

test('vira um EPUB com o título do PDF ou do nome do arquivo', async () => {
  const fromName = await parseEpub(
    await pdfToEpub(result([page(long)]), 'Meu Livro.pdf', 'urn:uuid:x', MODIFIED),
    'x.epub',
  )
  expect(fromName).toMatchObject({ title: 'Meu Livro', author: 'Autor desconhecido' })
  const fromMeta = await parseEpub(
    await pdfToEpub(result([page(long)], { title: 'Título Real', author: 'Fulana' }), 'x.pdf', 'urn:uuid:x', MODIFIED),
    'x.epub',
  )
  expect(fromMeta).toMatchObject({ title: 'Título Real', author: 'Fulana' })
})

test('o mesmo PDF, com o mesmo identificador e data, dá o mesmo ID de livro', async () => {
  const input = result([page(long), page(long + 'outra.')], { title: 'T', cover: '/9j/' })
  const a = await pdfToEpub(input, 'x.pdf', 'urn:sha256:abc', MODIFIED)
  const b = await pdfToEpub(input, 'x.pdf', 'urn:sha256:abc', MODIFIED)
  expect(bookIdFor(a)).toBe(bookIdFor(b))
  const c = await pdfToEpub(input, 'x.pdf', 'urn:sha256:def', MODIFIED)
  expect(bookIdFor(c)).not.toBe(bookIdFor(a))
})

test('PDF sem texto é recusado', async () => {
  await expect(pdfToEpub(result([page(''), page('  ')]), 'scan.pdf', 'urn:uuid:x', MODIFIED)).rejects.toThrow(
    PdfWithoutTextError,
  )
})

test('PDF em que tudo é cabeçalho repetido não vira um EPUB vazio', async () => {
  const pages = [1, 2, 3, 4].map(() => page(long))
  await expect(pdfToEpub(result(pages), 'x.pdf', 'urn:uuid:x', MODIFIED)).rejects.toThrow(PdfWithoutTextError)
})

test('base64ToBytes decodifica a assinatura de um JPEG', () => {
  expect(Array.from(base64ToBytes('/9j/'))).toEqual([0xff, 0xd8, 0xff])
})

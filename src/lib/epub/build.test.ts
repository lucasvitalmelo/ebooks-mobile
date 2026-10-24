import { DOMParser } from '@xmldom/xmldom'
import JSZip from 'jszip'
import { bookIdFor } from './book-id'
import { buildEpub } from './build'
import { parseEpub } from './parse'

const input = {
  identifier: 'urn:uuid:00000000-0000-4000-8000-000000000000',
  title: 'Livro & "Teste" <1>',
  author: 'Ana & Bia',
  language: 'pt-BR',
  modified: '2000-01-01T00:00:00Z',
  chapters: [
    { title: 'Um', paragraphs: ['Primeiro <parágrafo> & mais.', 'Segundo.'] },
    { title: 'Dois', paragraphs: ['Terceiro.'] },
  ],
  cover: { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9]), extension: 'jpg' as const },
}

test('o EPUB gerado abre no parser do app com título, autor e capa', async () => {
  const bytes = await buildEpub(input)
  const book = await parseEpub(bytes, 'x.epub')
  expect(book.title).toBe('Livro & "Teste" <1>')
  expect(book.author).toBe('Ana & Bia')
  expect(Array.from(book.cover!.bytes)).toEqual(Array.from(input.cover.bytes))
  expect(bookIdFor(bytes)).toMatch(/^[0-9a-f]{64}$/)
})

test('estrutura: mimetype primeiro sem compressão, um XHTML por capítulo, nav e texto escapado', async () => {
  const bytes = await buildEpub(input)
  expect(new TextDecoder().decode(bytes.subarray(30, 38))).toBe('mimetype')
  expect(bytes[8] | (bytes[9] << 8)).toBe(0)
  const zip = await JSZip.loadAsync(bytes)
  const cap1 = await zip.file('OEBPS/cap1.xhtml')!.async('string')
  expect(cap1).toContain('<h1>Um</h1>')
  expect(cap1).toContain('<p>Primeiro &lt;parágrafo&gt; &amp; mais.</p>')
  expect(zip.file('OEBPS/cap2.xhtml')).toBeTruthy()
  const nav = await zip.file('OEBPS/nav.xhtml')!.async('string')
  expect(nav).toContain('<a href="cap2.xhtml">Dois</a>')
})

test('caracteres de controle não quebram o XHTML e o resto do texto fica', async () => {
  const bytes = await buildEpub({
    ...input,
    title: 'Tí\u0002tulo',
    chapters: [{ title: 'Cap\u000b', paragraphs: ['antes\u0002depois \ud800 fim￾.', 'ok 😀'] }],
  })
  const zip = await JSZip.loadAsync(bytes)
  for (const name of ['OEBPS/cap1.xhtml', 'OEBPS/nav.xhtml', 'OEBPS/content.opf']) {
    const source = await zip.file(name)!.async('string')
    const doc = new DOMParser({
      onError: (level: string, message: string) => {
        throw new Error(`${level}: ${message}`)
      },
    }).parseFromString(source, 'application/xml')
    expect(doc.documentElement).toBeTruthy()
  }
  const cap1 = await zip.file('OEBPS/cap1.xhtml')!.async('string')
  expect(cap1).toContain('<p>antesdepois  fim.</p>')
  expect(cap1).toContain('ok 😀')
})

test('sem capa também funciona', async () => {
  const bytes = await buildEpub({ ...input, cover: null })
  expect((await parseEpub(bytes, 'x.epub')).cover).toBeNull()
})

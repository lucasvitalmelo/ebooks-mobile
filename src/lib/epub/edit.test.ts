import { readFileSync } from 'fs'
import JSZip from 'jszip'
import { bookIdFor } from './book-id'
import { editBookInfo, ProtectedEpubError, splitAuthors } from './edit'
import { parseEpub } from './parse'

const fixture = () => new Uint8Array(readFileSync(`${__dirname}/../../../fixtures/livro-de-teste.epub`))
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4, 5, 6])

test('troca título e autores e o resto do livro fica igual', async () => {
  const edited = await editBookInfo(fixture(), { title: 'Novo Título', author: 'Ana & Bia' })
  const book = await parseEpub(edited, 'x.epub')
  expect(book.title).toBe('Novo Título')
  expect(book.author).toBe('Ana & Bia')
  const before = await JSZip.loadAsync(fixture())
  const after = await JSZip.loadAsync(edited)
  expect(await after.file('OEBPS/cap1.xhtml')!.async('string')).toBe(
    await before.file('OEBPS/cap1.xhtml')!.async('string'),
  )
})

test('mimetype é a primeira entrada, sem compressão', async () => {
  const edited = await editBookInfo(fixture(), { title: 'T', author: 'A' })
  expect(new TextDecoder().decode(edited.subarray(30, 38))).toBe('mimetype')
  expect(edited[8] | (edited[9] << 8)).toBe(0)
})

const opfOf = async (file: Uint8Array) => (await JSZip.loadAsync(file)).file('OEBPS/content.opf')!.async('string')

test('capa JPEG sobre uma capa PNG vira um item novo', async () => {
  const edited = await editBookInfo(fixture(), {
    title: 'T',
    author: 'A',
    cover: { bytes: jpeg, width: 600, height: 900, type: 'image/jpeg' },
  })
  const book = await parseEpub(edited, 'x.epub')
  expect(book.cover?.extension).toBe('jpg')
  expect(Array.from(book.cover!.bytes)).toEqual(Array.from(jpeg))
})

test('capa PNG sobre uma capa PNG troca a imagem no mesmo item', async () => {
  const edited = await editBookInfo(fixture(), {
    title: 'T',
    author: 'A',
    cover: { bytes: png, width: 600, height: 900, type: 'image/png' },
  })
  const opf = await opfOf(edited)
  expect(opf).toMatch(/<item id="cover-image" href="capa\.png" media-type="image\/png" properties="cover-image"\/>/)
  expect(opf).not.toContain('cover-image.jpg')
  expect(opf).toMatch(/<meta name="cover" content="cover-image"\/>/)
  const book = await parseEpub(edited, 'x.epub')
  expect(book.cover?.extension).toBe('png')
  expect(Array.from(book.cover!.bytes)).toEqual(Array.from(png))
})

// O método de compressão no cabeçalho local da entrada: 0 = STORE, 8 = DEFLATE.
function compressionOf(zip: Uint8Array, name: string): number {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const decoder = new TextDecoder()
  for (let at = 0; at + 30 < zip.length; at++) {
    if (view.getUint32(at, true) !== 0x04034b50) continue
    const nameLength = view.getUint16(at + 26, true)
    if (decoder.decode(zip.subarray(at + 30, at + 30 + nameLength)) === name) return view.getUint16(at + 8, true)
  }
  throw new Error(`sem a entrada ${name}`)
}

test('imagens já comprimidas vão sem compressão; o resto, com', async () => {
  const edited = await editBookInfo(fixture(), { title: 'T', author: 'A' })
  expect(compressionOf(edited, 'OEBPS/figura.png')).toBe(0)
  expect(compressionOf(edited, 'OEBPS/cap1.xhtml')).toBe(8)
})

test('recusa livro com DRM', async () => {
  const zip = await JSZip.loadAsync(fixture())
  zip.file('META-INF/rights.xml', '<rights/>')
  const drm = await zip.generateAsync({ type: 'uint8array' })
  await expect(editBookInfo(drm, { title: 'T', author: 'A' })).rejects.toThrow(ProtectedEpubError)
})

test('o ID calculado muda (o OPF mudou), por isso o app guarda o ID antigo', async () => {
  const edited = await editBookInfo(fixture(), { title: 'T', author: 'A' })
  expect(bookIdFor(edited)).not.toBe(bookIdFor(fixture()))
})

test('separa autores por &', () => {
  expect(splitAuthors(' Ana &  Bia & ')).toEqual(['Ana', 'Bia'])
})

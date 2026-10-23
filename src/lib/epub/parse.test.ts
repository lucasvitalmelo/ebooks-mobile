import { readFileSync } from 'fs'
import JSZip from 'jszip'
import { InvalidEpubError, parseEpub, ProtectedEpubError } from './parse'

const fixture = () => readFileSync(`${__dirname}/../../../fixtures/livro-de-teste.epub`)

const container = `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OPS/pkg.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`

async function epubWith(opf: string, extra: Record<string, string | Uint8Array> = {}) {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip')
  zip.file('META-INF/container.xml', container)
  zip.file('OPS/pkg.opf', opf)
  for (const [path, data] of Object.entries(extra)) zip.file(path, data)
  return zip.generateAsync({ type: 'uint8array' })
}

const pkg = (metadata: string, manifest = '') =>
  `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" xmlns:opf="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${metadata}</metadata><manifest>${manifest}</manifest></package>`

test('lê título, autora e capa do fixture', async () => {
  const book = await parseEpub(fixture(), 'livro-de-teste.epub')
  expect(book.title).toBe('O Relógio Parado da Sala')
  expect(book.author).toBe('Joana Vieira')
  expect(book.cover?.extension).toBe('png')
  expect(Array.from(book.cover!.bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
})

test('prefere o título principal e ignora ilustrador', async () => {
  const bytes = await epubWith(
    pkg(`
      <dc:title id="c">Coleção Inteira</dc:title>
      <dc:title id="t">O Livro</dc:title>
      <meta refines="#t" property="title-type">main</meta>
      <dc:creator id="a1">Ana</dc:creator>
      <dc:creator id="i1">Ilustra</dc:creator>
      <meta refines="#i1" property="role" scheme="marc:relators">ill</meta>
      <dc:creator opf:role="aut">Bia</dc:creator>
      <dc:creator opf:role="trl">Tradutor</dc:creator>`),
  )
  const book = await parseEpub(bytes, 'x.epub')
  expect(book.title).toBe('O Livro')
  expect(book.author).toBe('Ana & Bia')
})

test('acha a capa pelo jeito EPUB 2 e resolve o caminho relativo', async () => {
  const bytes = await epubWith(
    pkg(
      '<dc:title>T</dc:title><meta name="cover" content="img"/>',
      '<item id="img" href="../imagens/capa.JPG" media-type="image/jpeg"/>',
    ),
    { 'imagens/capa.JPG': new Uint8Array([0xff, 0xd8, 0xff]) },
  )
  const book = await parseEpub(bytes, 'x.epub')
  expect(book.cover).toEqual({ bytes: new Uint8Array([0xff, 0xd8, 0xff]), extension: 'jpg' })
})

const jpeg = new Uint8Array([0xff, 0xd8, 0xff])

test('acha a capa por properties="cover-image" (EPUB 3)', async () => {
  const bytes = await epubWith(
    pkg(
      '<dc:title>T</dc:title>',
      '<item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="c" href="img/c.png" properties="svg cover-image" media-type="image/png"/>',
    ),
    { 'OPS/img/c.png': jpeg },
  )
  expect((await parseEpub(bytes, 'x.epub')).cover).toEqual({ bytes: jpeg, extension: 'png' })
})

test('acha a capa quando o meta cover aponta para o href', async () => {
  const bytes = await epubWith(
    pkg('<dc:title>T</dc:title><meta name="cover" content="img/capa.jpg"/>', '<item id="x" href="img/capa.jpg"/>'),
    { 'OPS/img/capa.jpg': jpeg },
  )
  expect((await parseEpub(bytes, 'x.epub')).cover).toEqual({ bytes: jpeg, extension: 'jpg' })
})

test('capa com href codificado, fragmento ou % solto', async () => {
  const encoded = await epubWith(
    pkg('<dc:title>T</dc:title><meta name="cover" content="i"/>', '<item id="i" href="capa%20x.jpg#f"/>'),
    { 'OPS/capa x.jpg': jpeg },
  )
  expect((await parseEpub(encoded, 'x.epub')).cover?.bytes).toEqual(jpeg)
  const stray = await epubWith(
    pkg('<dc:title>T</dc:title><meta name="cover" content="i"/>', '<item id="i" href="100%.jpg"/>'),
    { 'OPS/100%.jpg': jpeg },
  )
  expect((await parseEpub(stray, 'x.epub')).cover?.bytes).toEqual(jpeg)
})

test('decodifica referências numéricas e de entidade no título', async () => {
  const book = await parseEpub(await epubWith(pkg('<dc:title>Caf&#233; &#x2014; &#8217; &amp;</dc:title>')), 'x.epub')
  expect(book.title).toBe('Café — ’ &')
})

test('lê metadados dentro de dc-metadata e x-metadata (OEB 1.2)', async () => {
  const opf = `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata><dc-metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf"><dc:title>Velho</dc:title><dc:creator opf:role="aut">Zé</dc:creator></dc-metadata><x-metadata><meta name="cover" content="img"/></x-metadata></metadata><manifest><item id="img" href="c.jpg" media-type="image/jpeg"/></manifest></package>`
  const book = await parseEpub(await epubWith(opf, { 'OPS/c.jpg': jpeg }), 'x.epub')
  expect(book).toEqual({ title: 'Velho', author: 'Zé', cover: { bytes: jpeg, extension: 'jpg' } })
})

test('XML quebrado vira InvalidEpubError em português', async () => {
  const error = await parseEpub(await epubWith('<package><metadata><dc:title>x</metadata>'), 'x.epub').catch((e) => e)
  expect(error).toBeInstanceOf(InvalidEpubError)
  expect(error.message).toBe('EPUB corrompido')
})

test('sem título nem autor usa o nome do arquivo e "Autor desconhecido"', async () => {
  const book = await parseEpub(await epubWith(pkg('')), 'Meu Livro.epub')
  expect(book).toEqual({ title: 'Meu Livro', author: 'Autor desconhecido', cover: null })
})

test('título numérico continua texto', async () => {
  const book = await parseEpub(await epubWith(pkg('<dc:title>1984</dc:title>')), 'x.epub')
  expect(book.title).toBe('1984')
})

test('recusa o que não é EPUB', async () => {
  await expect(parseEpub(new Uint8Array([1, 2, 3]), 'x.epub')).rejects.toThrow(InvalidEpubError)
  const zip = new JSZip()
  zip.file('mimetype', 'application/zip')
  await expect(parseEpub(await zip.generateAsync({ type: 'uint8array' }), 'x.epub')).rejects.toThrow(InvalidEpubError)
})

test('recusa EPUB sem OPF', async () => {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip')
  await expect(parseEpub(await zip.generateAsync({ type: 'uint8array' }), 'x.epub')).rejects.toThrow('OPF')
})

test('recusa livro com DRM, mas aceita fonte ofuscada', async () => {
  const drm = await epubWith(pkg('<dc:title>T</dc:title>'), { 'META-INF/rights.xml': '<rights/>' })
  await expect(parseEpub(drm, 'x.epub')).rejects.toThrow(ProtectedEpubError)

  const encryption = (algorithm: string) =>
    `<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:EncryptionMethod Algorithm="${algorithm}"/></enc:EncryptedData></encryption>`
  const fonts = await epubWith(pkg('<dc:title>T</dc:title>'), {
    'META-INF/encryption.xml': encryption('http://www.idpf.org/2008/embedding'),
  })
  await expect(parseEpub(fonts, 'x.epub')).resolves.toMatchObject({ title: 'T' })
  const aes = await epubWith(pkg('<dc:title>T</dc:title>'), {
    'META-INF/encryption.xml': encryption('http://www.w3.org/2001/04/xmlenc#aes128-cbc'),
  })
  await expect(parseEpub(aes, 'x.epub')).rejects.toThrow(ProtectedEpubError)
})

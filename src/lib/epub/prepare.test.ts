import { readFileSync } from 'fs'
import JSZip from 'jszip'
import { bookIdFor } from './book-id'
import { prepareEpub } from './prepare'

const fixture = () => new Uint8Array(readFileSync(`${__dirname}/../../../fixtures/livro-de-teste.epub`))

async function withCss(css: string) {
  const zip = await JSZip.loadAsync(fixture())
  zip.file('OEBPS/estilo.css', css)
  return zip.generateAsync({ type: 'uint8array' })
}

test('tira a cor das folhas de estilo e mantém o resto do livro', async () => {
  const input = await withCss('p { color: #000; margin: 0 }')
  const { bytes, changed } = await prepareEpub(input)
  expect(changed).toBe(true)
  const zip = await JSZip.loadAsync(bytes)
  expect(await zip.file('OEBPS/estilo.css')!.async('string')).toBe('p { margin: 0 }')
  const before = await JSZip.loadAsync(input)
  expect(await zip.file('OEBPS/cap1.xhtml')!.async('string')).toBe(
    await before.file('OEBPS/cap1.xhtml')!.async('string'),
  )
})

test('o ID do livro não muda', async () => {
  const input = await withCss('p { color: red }')
  expect(bookIdFor((await prepareEpub(input)).bytes)).toBe(bookIdFor(input))
})

test('nada a limpar devolve os mesmos bytes', async () => {
  const input = await withCss('p { margin: 0 }')
  const result = await prepareEpub(input)
  expect(result.changed).toBe(false)
  expect(result.bytes).toBe(input)
})

test('o que não abre como zip volta como veio', async () => {
  const junk = new Uint8Array([1, 2, 3])
  expect(await prepareEpub(junk)).toEqual({ bytes: junk, changed: false })
})

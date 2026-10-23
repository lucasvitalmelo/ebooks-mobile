import { readFileSync } from 'fs'
import JSZip from 'jszip'
import { bookIdFor } from './book-id'

const fixture = () => readFileSync(`${__dirname}/../../../fixtures/livro-de-teste.epub`)

test('dá o mesmo ID que o leitor web para o fixture', () => {
  expect(bookIdFor(fixture())).toBe('43c52b34cb6c2ea54eb510464e511f7ac09fb7570643d3ccce2e642417489c42')
})

test('aceita um Uint8Array que é pedaço de um buffer maior', () => {
  const bytes = fixture()
  const padded = new Uint8Array(bytes.length + 16)
  padded.set(bytes, 8)
  expect(bookIdFor(padded.subarray(8, 8 + bytes.length))).toBe(bookIdFor(bytes))
})

test('não muda quando só as folhas de estilo mudam', async () => {
  const zip = await JSZip.loadAsync(fixture())
  zip.file('OEBPS/estilo.css', 'body { color: red }')
  const changed = await zip.generateAsync({ type: 'uint8array' })
  expect(bookIdFor(changed)).toBe(bookIdFor(fixture()))
})

test('muda quando o texto muda', async () => {
  const zip = await JSZip.loadAsync(fixture())
  zip.file('OEBPS/cap1.xhtml', '<html/>')
  expect(bookIdFor(await zip.generateAsync({ type: 'uint8array' }))).not.toBe(bookIdFor(fixture()))
})

const date = new Date('2026-01-01T00:00:00Z')
// O JSZip aceita bytes aqui, mas os tipos dele só declaram string.
const latin1 = ((name: string) => Uint8Array.from(name, (char) => char.charCodeAt(0))) as unknown as (
  name: string,
) => string

// Os IDs fixados abaixo vêm do bookIdFor do leitor web (leitor_epub/src/lib/epub/book-id.ts)
// rodado sobre exatamente estes zips (data fixa em cada arquivo, para os bytes serem estáveis).
test('lê nomes com acento como o leitor web', async () => {
  const zip = new JSZip()
  zip.file('OEBPS/capítulo.xhtml', 'x', { date })
  const other = new JSZip()
  other.file('OEBPS/capitulo.xhtml', 'x', { date })
  expect(bookIdFor(await zip.generateAsync({ type: 'uint8array' }))).toBe(
    'da43773571a57f5572dfcca58b3a5b85278c9382a409c9b97ac0469d16c4b719',
  )
  expect(bookIdFor(await other.generateAsync({ type: 'uint8array' }))).toBe(
    '8fb12af6d5f5d23c9bb2551e64bc10ece340f394bad12c183f3b933362df154b',
  )
})

test('nome em latin1 (UTF-8 inválido) dá o mesmo ID que o leitor web', async () => {
  const zip = new JSZip()
  zip.file('OEBPS/capé.xhtml', 'x', { date })
  const bytes = await zip.generateAsync({ type: 'uint8array', encodeFileName: latin1 })
  expect(bookIdFor(bytes)).toBe('ac1640128766b7ff6c85b477431589519ce36198ced6ccc8dc7b036fb684fcf8')
})

test('recusa o que não é zip', () => {
  expect(() => bookIdFor(new Uint8Array([1, 2, 3]))).toThrow('Não é um arquivo zip')
})

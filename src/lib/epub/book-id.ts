import { sha256, toHex } from './sha256'
import { decodeUtf8, encodeUtf8 } from './utf8'

// O ID do livro tem que ser o mesmo em todo aparelho que tem o mesmo livro —
// inclusive no leitor web, que reescreve as folhas de estilo ao importar. Por
// isso ele cobre o que nenhum dos dois muda: caminho, CRC-32 e tamanho de cada
// entrada do zip, exceto folhas de estilo e mimetype. Mesmo algoritmo de
// leitor_epub/src/lib/epub/book-id.ts; os três números vêm do diretório
// central, sem descompactar nada.
export function bookIdFor(bytes: Uint8Array): string {
  const entries = readEntries(bytes).filter(
    (entry) => !entry.name.endsWith('/') && entry.name !== 'mimetype' && !/\.css$/i.test(entry.name),
  )
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const manifest = entries
    .map((entry) => `${entry.name}\0${entry.crc32.toString(16).padStart(8, '0')}\0${entry.size}`)
    .join('\n')
  return toHex(sha256(encodeUtf8(manifest)))
}

interface ZipEntry {
  name: string
  crc32: number
  size: number
}

const END_OF_DIRECTORY = 0x06054b50
const DIRECTORY_ENTRY = 0x02014b50
// O registro final tem 22 bytes mais um comentário de até 65535.
const END_SEARCH = 22 + 0xffff

function readEntries(bytes: Uint8Array): ZipEntry[] {
  const tail = bytes.subarray(Math.max(0, bytes.length - END_SEARCH))
  const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength)
  let end = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tailView.getUint32(i, true) === END_OF_DIRECTORY) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error('Não é um arquivo zip')
  const count = tailView.getUint16(end + 10, true)
  const size = tailView.getUint32(end + 12, true)
  const offset = tailView.getUint32(end + 16, true)
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) throw new Error('Zip64 não suportado')

  const directory = bytes.subarray(offset, offset + size)
  const view = new DataView(directory.buffer, directory.byteOffset, directory.byteLength)
  const entries: ZipEntry[] = []
  let position = 0
  for (let n = 0; n < count; n++) {
    if (position + 46 > directory.length || view.getUint32(position, true) !== DIRECTORY_ENTRY) {
      throw new Error('Diretório do zip corrompido')
    }
    const nameLength = view.getUint16(position + 28, true)
    const extraLength = view.getUint16(position + 30, true)
    const commentLength = view.getUint16(position + 32, true)
    entries.push({
      name: decodeUtf8(directory.subarray(position + 46, position + 46 + nameLength)),
      crc32: view.getUint32(position + 16, true),
      size: view.getUint32(position + 24, true),
    })
    position += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

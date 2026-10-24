import { Directory, File, Paths } from 'expo-file-system'
import { bookPath, coverPath } from './book-paths'

// Caminhos relativos ao documentDirectory: o absoluto pode mudar entre
// versões do app no iOS, e o banco guardaria um caminho que não existe mais.
export function fileAt(relativePath: string): File {
  return new File(Paths.document, relativePath)
}

function ensureDirectory(name: string) {
  new Directory(Paths.document, name).create({ idempotent: true, intermediates: true })
}

export function readBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes()
}

export function readBase64(relativePath: string): Promise<string> {
  return fileAt(relativePath).base64()
}

export async function storeBook(id: string, bytes: Uint8Array): Promise<void> {
  ensureDirectory('books')
  await writeBytes(bookPath(id), bytes)
}

export async function storeCover(id: string, bytes: Uint8Array, extension: string): Promise<void> {
  ensureDirectory('covers')
  const file = fileAt(coverPath(id, extension))
  file.create({ overwrite: true })
  await file.write(bytes)
}

export async function writeBytes(relativePath: string, bytes: Uint8Array): Promise<void> {
  const file = fileAt(relativePath)
  file.create({ overwrite: true, intermediates: true })
  await file.write(bytes)
}

// Escreve ao lado e só então troca: o `create` com overwrite trunca o arquivo, e
// uma falha no meio da escrita deixaria o livro pela metade no lugar do original.
export async function replaceBytes(relativePath: string, bytes: Uint8Array): Promise<void> {
  const temporary = fileAt(`${relativePath}.tmp`)
  temporary.create({ overwrite: true, intermediates: true })
  try {
    await temporary.write(bytes)
    await temporary.move(fileAt(relativePath), { overwrite: true })
  } catch (error) {
    deleteQuietly(temporary)
    throw error
  }
}

export function readFileBytes(relativePath: string): Promise<Uint8Array> {
  return fileAt(relativePath).bytes()
}

// Uma cópia no cache com o nome de exportação: o compartilhamento usa o nome do
// arquivo. A pasta é esvaziada a cada exportação para as cópias não se acumularem.
export async function copyForExport(relativePath: string, name: string): Promise<string> {
  const folder = new Directory(Paths.cache, 'export')
  if (folder.exists) folder.delete()
  folder.create({ idempotent: true, intermediates: true })
  const target = new File(folder, name)
  await fileAt(relativePath).copy(target)
  return target.uri
}

function deleteQuietly(file: File) {
  try {
    if (file.exists) file.delete()
  } catch (error) {
    console.warn('Não foi possível apagar', file.uri, error)
  }
}

// Nunca lança: roda em caminhos de erro, onde uma falha aqui esconderia o erro original.
export function deleteFiles(paths: (string | null)[]): void {
  for (const path of paths) {
    if (path) deleteQuietly(fileAt(path))
  }
}

export function discardPicked(uri: string): void {
  deleteQuietly(new File(uri))
}

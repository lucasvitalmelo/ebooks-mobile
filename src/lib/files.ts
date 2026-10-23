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

export async function storeBook(id: string, sourceUri: string): Promise<void> {
  ensureDirectory('books')
  await new File(sourceUri).copy(fileAt(bookPath(id)), { overwrite: true })
}

export async function storeCover(id: string, bytes: Uint8Array, extension: string): Promise<void> {
  ensureDirectory('covers')
  const file = fileAt(coverPath(id, extension))
  file.create({ overwrite: true })
  await file.write(bytes)
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

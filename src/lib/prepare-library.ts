import { getBook, listUnprepared, markFileForUpload, markPrepared } from './db/books'
import type { Db } from './db/db'
import { prepareEpub } from './epub/prepare'
import { withLibraryLock } from './library-lock'

export interface PrepareDeps {
  db: Db
  readFile(path: string): Promise<Uint8Array>
  replaceFile(path: string, bytes: Uint8Array): Promise<void>
}

// Uma vez por livro importado antes da limpeza existir; falha também marca,
// para não tentar o mesmo arquivo a cada abertura da biblioteca. Cada livro
// roda dentro do lock e relê o registro: se foi removido ou o arquivo mudou
// desde a listagem, é pulado.
export async function prepareLibrary(deps: PrepareDeps): Promise<void> {
  for (const listed of await listUnprepared(deps.db)) {
    await withLibraryLock(async () => {
      const book = await getBook(deps.db, listed.id)
      if (!book || book.filePath !== listed.filePath || book.prepared) return
      try {
        const { bytes, changed } = await prepareEpub(await deps.readFile(book.filePath))
        if (changed) {
          await deps.replaceFile(book.filePath, bytes)
          await markFileForUpload(deps.db, book.id)
        }
      } catch (error) {
        console.warn('Não foi possível limpar o livro', book.id, error)
      }
      await markPrepared(deps.db, book.id)
    })
  }
}

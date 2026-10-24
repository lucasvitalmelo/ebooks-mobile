import { bookPath } from '@/lib/book-paths'
import { deleteBook, getBook, insertBook, setFontScale, updateBookInfo } from '@/lib/db/books'
import { setDriveEnabled } from '@/lib/db/deletions'
import { addHighlight, deleteHighlight, listHighlights, setHighlightNote } from '@/lib/db/highlights'
import { migrate } from '@/lib/db/migrations'
import { getProgress, saveProgress } from '@/lib/db/progress'
import { getDriveFolders } from '@/lib/db/sync'
import { openTestDb } from '@/lib/db/testing/node-db'
import { DriveAuthError } from '@/lib/drive/auth-error'
import { ensureBookFile, needsDownload, type BookFileDeps } from './book-file'
import { FakeDrive } from './fake-drive'
import { parseLibraryFile } from './library-file'
import { SyncError, syncNow, type SyncDeps } from './run'

const EPUB = 'application/epub+zip'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2])

// Cada "aparelho" tem o seu banco e os seus arquivos; todos sincronizam pelo
// mesmo Drive em memória.
async function device(drive: FakeDrive) {
  const db = openTestDb()
  await migrate(db)
  await setDriveEnabled(db, true)
  const files = new Map<string, Uint8Array>()
  const deps: SyncDeps = {
    db,
    api: drive,
    readFile: async (path) => {
      const bytes = files.get(path)
      if (!bytes) throw new Error(`sem arquivo ${path}`)
      return bytes
    },
    writeFile: async (path, bytes) => void files.set(path, bytes),
    deleteFiles: (paths) => paths.forEach((path) => path && files.delete(path)),
    lock: (fn) => fn(),
  }
  return { db, files, deps }
}

type Device = Awaited<ReturnType<typeof device>>

async function addLocalBook(d: Device, id: string, addedAt = 100) {
  d.files.set(bookPath(id), new TextEncoder().encode(`epub ${id}`))
  await insertBook(d.db, {
    id,
    title: `Livro ${id}`,
    author: 'A',
    filePath: bookPath(id),
    coverPath: null,
    size: 6,
    addedAt,
  })
}

// O addBook do web: o arquivo e a capa no disco, o registro no banco.
async function addBook(
  d: Device,
  book: { id: string; title: string; author: string; content: string; addedAt: number; cover?: Uint8Array },
) {
  const content = new TextEncoder().encode(book.content)
  d.files.set(bookPath(book.id), content)
  const cover = book.cover ? `covers/${book.id}.png` : null
  if (cover) d.files.set(cover, book.cover!)
  await insertBook(d.db, {
    id: book.id,
    title: book.title,
    author: book.author,
    filePath: bookPath(book.id),
    coverPath: cover,
    size: content.length,
    addedAt: book.addedAt,
  })
  return content
}

// Editar troca o arquivo inteiro (título e autor vão dentro do EPUB).
async function editBook(d: Device, id: string, info: { title: string; author: string; content: string }, at: number) {
  const content = new TextEncoder().encode(info.content)
  d.files.set(bookPath(id), content)
  await updateBookInfo(d.db, id, { title: info.title, author: info.author, coverPath: null }, at)
  return content
}

function bookFiles(d: Device, drive: FakeDrive): BookFileDeps {
  return {
    db: d.db,
    api: drive,
    replaceFile: async (path, bytes) => void d.files.set(path, bytes),
    lock: (fn) => fn(),
  }
}

function libraryOn(drive: FakeDrive) {
  const file = [...drive.files.values()].find((f) => f.name === 'biblioteca.json')
  return file ? parseLibraryFile(new TextDecoder().decode(file.content!)) : null
}

const epubFiles = (drive: FakeDrive) => [...drive.files.values()].filter((file) => file.mimeType === EPUB)

describe('sincronização entre dois aparelhos', () => {
  test('o livro importado no celular aparece no PC, abre lá, e o progresso de lá volta ao celular', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    const content = await addBook(phone, {
      id: 'dom',
      title: 'Dom Casmurro',
      author: 'Machado de Assis',
      content: 'Capítulo um',
      addedAt: 100,
      cover: PNG,
    })
    await setFontScale(phone.db, 'dom', 1.1)
    await saveProgress(phone.db, { bookId: 'dom', cfi: 'epubcfi(/6/4)', percent: 0.12 }, 150)

    expect(await syncNow(phone.deps)).toMatchObject({ uploaded: 1 })
    expect(await getBook(phone.db, 'dom')).toMatchObject({ pendingUpload: 0 })
    expect(epubFiles(drive)).toEqual([
      expect.objectContaining({ name: 'Dom Casmurro - Machado de Assis.epub', appProperties: { bookId: 'dom' } }),
    ])
    expect(await drive.library()).toMatchObject({
      books: { dom: { title: 'Dom Casmurro', fontScale: 1.1 } },
      progress: { dom: { percentage: 12 } },
    })

    const pc = await device(drive)
    const uploadsBefore = drive.uploads
    const onApplied = jest.fn()
    expect(await syncNow(pc.deps, onApplied)).toMatchObject({ uploaded: 0, covers: 1 })
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(drive.uploads).toBe(uploadsBefore)
    const cloud = (await getBook(pc.db, 'dom'))!
    expect(cloud).toMatchObject({ title: 'Dom Casmurro', blobUpdatedAt: null, pendingUpload: 0, fontScale: 1.1 })
    expect(pc.files.get(cloud.coverPath!)).toEqual(PNG)
    expect(await getProgress(pc.db, 'dom')).toMatchObject({ cfi: 'epubcfi(/6/4)', percent: 0.12 })

    await ensureBookFile(bookFiles(pc, drive), cloud)
    expect(pc.files.get(bookPath('dom'))).toEqual(content)
    await saveProgress(pc.db, { bookId: 'dom', cfi: 'epubcfi(/6/8)', percent: 0.4 }, 500)
    await syncNow(pc.deps)

    await syncNow(phone.deps)
    expect(await getProgress(phone.db, 'dom')).toMatchObject({ cfi: 'epubcfi(/6/8)', percent: 0.4 })
    expect(epubFiles(drive)).toHaveLength(1)
  })

  test('grifos e notas vão e voltam, e o que foi removido num aparelho sai do outro', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addBook(phone, { id: 'mem', title: 'Memórias', author: 'Machado', content: 'Capítulo dois', addedAt: 100 })
    await addHighlight(phone.db, {
      id: 'h1',
      bookId: 'mem',
      cfiRange: 'epubcfi(/6/4!/4/2,/1:0,/1:5)',
      text: 'Ao verme',
      createdAt: 200,
    })
    await syncNow(phone.deps)

    const pc = await device(drive)
    await syncNow(pc.deps)
    expect(await listHighlights(pc.db, 'mem')).toEqual([expect.objectContaining({ id: 'h1', text: 'Ao verme' })])
    await setHighlightNote(pc.db, 'h1', 'a dedicatória', 300)
    await syncNow(pc.deps)
    await syncNow(phone.deps)
    expect((await listHighlights(phone.db, 'mem'))[0].note).toBe('a dedicatória')

    await deleteHighlight(phone.db, 'h1', 400)
    await syncNow(phone.deps)
    await syncNow(pc.deps)
    expect(await listHighlights(pc.db, 'mem')).toEqual([])

    await deleteBook(pc.db, 'mem', 500)
    await syncNow(pc.deps)
    await syncNow(phone.deps)
    expect(await getBook(phone.db, 'mem')).toBeNull()
  })

  test('uma edição vence, sobe, e o outro aparelho baixa o arquivo novo', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addBook(phone, { id: 'qb', title: 'Quincas', author: 'Machado', content: 'Capítulo três', addedAt: 100 })
    await syncNow(phone.deps)
    const pc = await device(drive)
    await syncNow(pc.deps)
    await ensureBookFile(bookFiles(pc, drive), (await getBook(pc.db, 'qb'))!)

    const edited = await editBook(
      phone,
      'qb',
      { title: 'Quincas Borba', author: 'Machado', content: 'Capítulo três, revisto' },
      300,
    )
    await syncNow(phone.deps)
    await syncNow(pc.deps)

    const there = (await getBook(pc.db, 'qb'))!
    expect(there.title).toBe('Quincas Borba')
    expect(needsDownload(there)).toBe(true)
    await ensureBookFile(bookFiles(pc, drive), there)
    expect(pc.files.get(bookPath('qb'))).toEqual(edited)
    expect(epubFiles(drive)).toHaveLength(1)
  })

  test('o mesmo livro importado nos dois aparelhos fica um só no Drive, sem subir duas vezes', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addBook(phone, { id: 'he', title: 'Helena', author: 'Machado', content: 'Capítulo quatro', addedAt: 100 })
    const pc = await device(drive)
    await addBook(pc, { id: 'he', title: 'Helena', author: 'Machado', content: 'Capítulo quatro', addedAt: 300 })

    await syncNow(phone.deps)
    const uploadsBefore = drive.uploads
    await syncNow(pc.deps)

    expect(epubFiles(drive)).toHaveLength(1)
    // Só a biblioteca foi gravada: a cópia do PC não subiu de novo.
    expect(drive.uploads - uploadsBefore).toBe(1)
    expect(await getBook(pc.db, 'he')).toMatchObject({ pendingUpload: 0, blobUpdatedAt: expect.any(Number) })
  })

  test('o que um aparelho removeu antes da primeira sincronização dele não apaga nada nos outros', async () => {
    const drive = new FakeDrive()
    const pc = await device(drive)
    await addBook(pc, { id: 'ia', title: 'Iaiá Garcia', author: 'Machado', content: 'Capítulo cinco', addedAt: 100 })
    await syncNow(pc.deps)

    // Removido quando a exclusão ainda era só deste aparelho.
    const phone = await device(drive)
    await addBook(phone, { id: 'ia', title: 'Iaiá Garcia', author: 'Machado', content: 'Capítulo cinco', addedAt: 200 })
    await deleteBook(phone.db, 'ia', 250)
    await syncNow(phone.deps)
    await syncNow(pc.deps)

    expect(await getBook(pc.db, 'ia')).toMatchObject({ title: 'Iaiá Garcia', blobUpdatedAt: expect.any(Number) })
    // Os dois lados somados: o celular recebe o livro de volta, do Drive.
    expect(await getBook(phone.db, 'ia')).toMatchObject({ blobUpdatedAt: null })
  })

  test('dois aparelhos que sincronizam pela primeira vez ao mesmo tempo ficam com a mesma pasta', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addBook(phone, { id: 're', title: 'Ressurreição', author: 'Machado', content: 'Capítulo oito', addedAt: 100 })
    const app = await device(drive)

    await Promise.all([syncNow(phone.deps), syncNow(app.deps)])

    expect((await getDriveFolders(app.db))?.root).toBe((await getDriveFolders(phone.db))?.root)
    await syncNow(app.deps)
    expect(await getBook(app.db, 're')).toMatchObject({ title: 'Ressurreição', blobUpdatedAt: null })
  })

  test('um livro que o Drive recusa não trava os outros e aparece na contagem', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addBook(phone, { id: 'ej', title: 'Esaú e Jacó', author: 'Machado', content: 'Capítulo seis', addedAt: 100 })
    await addBook(phone, {
      id: 'ma',
      title: 'Memorial de Aires',
      author: 'Machado',
      content: 'Capítulo sete',
      addedAt: 100,
    })
    await syncNow(phone.deps)

    // O EPUB do primeiro apagado à mão no Drive, e os dois livros editados aqui.
    drive.files.delete((await getBook(phone.db, 'ej'))!.driveFileId!)
    await editBook(
      phone,
      'ej',
      { title: 'Esaú e Jacó, revisto', author: 'Machado', content: 'Capítulo seis, revisto' },
      300,
    )
    await editBook(
      phone,
      'ma',
      { title: 'Memorial de Aires, revisto', author: 'Machado', content: 'Capítulo sete, revisto' },
      300,
    )

    expect(await syncNow(phone.deps)).toMatchObject({ uploaded: 1, skipped: 1 })
    expect(await getBook(phone.db, 'ej')).toMatchObject({ pendingUpload: 1 })
    expect(await getBook(phone.db, 'ma')).toMatchObject({ pendingUpload: 0 })
  })

  test('com o Drive cheio, o que vem de lá continua chegando, e a sincronização avisa', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addBook(phone, {
      id: 'cv',
      title: 'Casa Velha',
      author: 'Machado',
      content: 'Capítulo dez',
      addedAt: 100,
      cover: PNG,
    })
    await syncNow(phone.deps)

    const pc = await device(drive)
    await addBook(pc, { id: 'pc', title: 'Do PC', author: 'Autor', content: 'Capítulo onze', addedAt: 300 })
    drive.full = true

    await expect(syncNow(pc.deps)).rejects.toMatchObject({ problem: 'cheio', booksAdded: 1 })
    const arrived = (await getBook(pc.db, 'cv'))!
    expect(pc.files.get(arrived.coverPath!)).toEqual(PNG)
  })

  test('a pasta das capas apagada no Drive também vira um erro claro', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await syncNow(phone.deps)
    ;[...drive.files.values()].find((file) => file.name === 'capas')!.trashed = true

    await expect(syncNow(phone.deps)).rejects.toMatchObject({
      problem: 'pasta',
      message: expect.stringContaining('capas'),
    })
  })

  test('a pasta do app apagada no Drive vira um erro claro, sem criar outra', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await syncNow(phone.deps)
    const root = [...drive.files.values()].find((file) => file.name === 'MyBooks')!
    root.trashed = true
    const folders = drive.files.size

    await expect(syncNow(phone.deps)).rejects.toMatchObject({ problem: 'pasta' })
    expect(drive.files.size).toBe(folders)
  })

  test('avisa o andamento dos envios livro a livro, contando o recusado, e nada quando não há o que enviar', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addBook(phone, { id: 'gr', title: 'Grande', author: 'Autor', content: 'Capítulo doze', addedAt: 100 })
    await addBook(phone, { id: 'pq', title: 'Pequeno', author: 'Autor', content: 'Capítulo treze', addedAt: 100 })
    // Um arquivo que o Drive não tem mais: o envio é recusado (404).
    await phone.db.run("UPDATE books SET driveFileId = 'sumiu' WHERE id = 'gr'")
    const onProgress = jest.fn()

    expect(await syncNow(phone.deps, undefined, onProgress)).toMatchObject({ uploaded: 1, skipped: 1 })
    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { done: 0, total: 2 },
      { done: 1, total: 2 },
      { done: 2, total: 2 },
    ])

    // O PC recebe o livro sem o arquivo: nada dele para enviar.
    const pc = await device(drive)
    const quiet = jest.fn()
    await syncNow(pc.deps, undefined, quiet)
    expect(quiet).not.toHaveBeenCalled()
  })

  test('o resumo separa os livros que chegaram e os que foram removidos no outro aparelho', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addBook(phone, {
      id: 'ml',
      title: 'A Mão e a Luva',
      author: 'Machado',
      content: 'Capítulo treze',
      addedAt: 100,
    })
    await saveProgress(phone.db, { bookId: 'ml', cfi: 'epubcfi(/6/4)', percent: 0.05 }, 150)
    await syncNow(phone.deps)

    const pc = await device(drive)
    expect(await syncNow(pc.deps)).toMatchObject({ applied: 2, booksAdded: 1, booksRemoved: 0 })

    await deleteBook(phone.db, 'ml', 300)
    await syncNow(phone.deps)
    expect(await syncNow(pc.deps)).toMatchObject({ booksAdded: 0, booksRemoved: 1 })
  })

  test('os livros que chegaram contam mesmo se gravar a biblioteca no Drive falhar', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addBook(phone, { id: 'co', title: 'Contos', author: 'Machado', content: 'Capítulo catorze', addedAt: 100 })
    await syncNow(phone.deps)
    const pc = await device(drive)
    await syncNow(pc.deps)

    await addBook(phone, { id: 'cr', title: 'Crônicas', author: 'Machado', content: 'Capítulo quinze', addedAt: 200 })
    await syncNow(phone.deps)

    // O PC leu mais um pouco: a biblioteca juntada difere da do Drive, e gravá-la falha.
    await saveProgress(pc.db, { bookId: 'co', cfi: 'epubcfi(/6/4)', percent: 0.3 }, 900)
    drive.full = true
    await expect(syncNow(pc.deps)).rejects.toMatchObject({ problem: 'cheio', booksAdded: 1 })
  })
})

describe('conversões do app', () => {
  test('primeira sincronização sobe o livro e o põe na biblioteca do Drive', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addLocalBook(phone, 'a')
    const summary = await syncNow(phone.deps)
    expect(summary).toMatchObject({ uploaded: 1, skipped: 0 })
    const epub = [...drive.files.values()].find((f) => f.name === 'Livro a - A.epub')
    expect(epub?.appProperties).toEqual({ bookId: 'a' })
    expect(Object.keys(libraryOn(drive)!.books)).toEqual(['a'])
    expect(await getBook(phone.db, 'a')).toMatchObject({ pendingUpload: 0, driveFileId: epub!.id })
  })

  test('o livro chega no outro aparelho só na nuvem e o progresso viaja', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    const tablet = await device(drive)
    await addLocalBook(phone, 'a')
    await saveProgress(phone.db, { bookId: 'a', cfi: 'epubcfi(/6/2)', percent: 0.3 }, 500)
    await syncNow(phone.deps)
    const summary = await syncNow(tablet.deps)
    expect(summary.booksAdded).toBe(1)
    expect(await getBook(tablet.db, 'a')).toMatchObject({ blobUpdatedAt: null })
    expect(await getProgress(tablet.db, 'a')).toMatchObject({ cfi: 'epubcfi(/6/2)', percent: 0.3, updatedAt: 500 })
  })

  test('grifo e exclusão vão de um aparelho para o outro', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    const tablet = await device(drive)
    await addLocalBook(phone, 'a')
    await addHighlight(phone.db, { id: 'h', bookId: 'a', cfiRange: 'epubcfi(/6/4)', text: 'x', createdAt: 10 })
    await syncNow(phone.deps)
    await syncNow(tablet.deps)
    expect(await tablet.db.getAll('SELECT id FROM highlights')).toEqual([{ id: 'h' }])
    await deleteBook(tablet.db, 'a', Date.now())
    await syncNow(tablet.deps)
    const summary = await syncNow(phone.deps)
    expect(summary.booksRemoved).toBe(1)
    expect(await getBook(phone.db, 'a')).toBeNull()
    expect(phone.files.has(bookPath('a'))).toBe(false)
  })

  test('a primeira sincronização do aparelho descarta as exclusões de antes', async () => {
    const drive = new FakeDrive()
    const web = await device(drive)
    await addLocalBook(web, 'a')
    await syncNow(web.deps)
    const phone = await device(drive)
    await phone.db.run("INSERT INTO deletions (key, deletedAt) VALUES ('book:a', 99999)")
    await syncNow(phone.deps)
    expect(Object.keys(libraryOn(drive)!.books)).toEqual(['a'])
  })

  test('Drive cheio vira SyncError cheio e o livro continua pendente', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addLocalBook(phone, 'a')
    drive.full = true
    const error = await syncNow(phone.deps).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SyncError)
    expect((error as SyncError).problem).toBe('cheio')
    expect((await getBook(phone.db, 'a'))?.pendingUpload).toBe(1)
  })

  test('login recusado vira SyncError conta', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    // Object.create mantém os métodos do FakeDrive (um spread perderia o protótipo).
    const api = Object.create(drive) as FakeDrive
    api.findFolder = async () => Promise.reject(new DriveAuthError('reconectar', 'x'))
    phone.deps.api = api
    const error = (await syncNow(phone.deps).catch((e: unknown) => e)) as SyncError
    expect(error.problem).toBe('conta')
  })

  test('capa de outro aparelho é baixada com a extensão certa', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    const tablet = await device(drive)
    await addLocalBook(phone, 'a')
    phone.files.set('covers/a.png', PNG)
    await phone.db.run("UPDATE books SET coverPath = 'covers/a.png' WHERE id = 'a'")
    await syncNow(phone.deps)
    const summary = await syncNow(tablet.deps)
    expect(summary.covers).toBe(1)
    expect((await getBook(tablet.db, 'a'))?.coverPath).toBe('covers/a.png')
    expect(tablet.files.get('covers/a.png')?.[0]).toBe(0x89)
  })

  test('capa que chegou aqui durante o download da de lá fica', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    const tablet = await device(drive)
    await addLocalBook(phone, 'a')
    phone.files.set('covers/a.png', PNG)
    await phone.db.run("UPDATE books SET coverPath = 'covers/a.png' WHERE id = 'a'")
    await syncNow(phone.deps)
    const downloadBytes = drive.downloadBytes.bind(drive)
    tablet.deps.api = Object.assign(Object.create(drive) as FakeDrive, {
      downloadBytes: async (id: string) => {
        const bytes = await downloadBytes(id)
        // Uma edição feita no tablet enquanto a capa descia.
        tablet.files.set('covers/a.jpg', new Uint8Array([0xff]))
        await tablet.db.run("UPDATE books SET coverPath = 'covers/a.jpg' WHERE id = 'a'")
        return bytes
      },
    })
    const summary = await syncNow(tablet.deps)
    expect(summary.covers).toBe(0)
    expect((await getBook(tablet.db, 'a'))?.coverPath).toBe('covers/a.jpg')
    expect(tablet.files.has('covers/a.png')).toBe(false)
  })

  test('um livro cujo arquivo sumiu daqui não trava os envios seguintes', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addLocalBook(phone, 'sumiu', 100)
    await addLocalBook(phone, 'bom', 200)
    phone.files.delete(bookPath('sumiu'))
    expect(await syncNow(phone.deps)).toMatchObject({ uploaded: 1, skipped: 1 })
    expect(await getBook(phone.db, 'bom')).toMatchObject({ pendingUpload: 0 })
    expect(await getBook(phone.db, 'sumiu')).toMatchObject({ pendingUpload: 1 })
  })

  test('duas chamadas ao mesmo tempo viram uma sincronização só', async () => {
    const drive = new FakeDrive()
    const phone = await device(drive)
    await addLocalBook(phone, 'a')
    const [first, second] = await Promise.all([syncNow(phone.deps), syncNow(phone.deps)])
    expect(second).toBe(first)
    expect([...drive.files.values()].filter((f) => f.name.endsWith('.epub'))).toHaveLength(1)
  })
})

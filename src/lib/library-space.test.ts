import { canFreeSpace, formatSize, spaceUsed } from './library-space'

const book = (overrides: object) =>
  ({ size: 1_000_000, blobUpdatedAt: 1, driveFileId: 'f', pendingUpload: 0, ...overrides }) as never

test('soma só os livros com arquivo aqui', () => {
  expect(spaceUsed([book({}), book({ size: 500_000 }), book({ blobUpdatedAt: null })])).toEqual({
    bytes: 1_500_000,
    books: 2,
  })
})

test('libera só o que está no Drive sem nada pendente', () => {
  expect(canFreeSpace(book({}))).toBe(true)
  expect(canFreeSpace(book({ pendingUpload: 1 }))).toBe(false)
  expect(canFreeSpace(book({ driveFileId: null }))).toBe(false)
  expect(canFreeSpace(book({ blobUpdatedAt: null }))).toBe(false)
})

test('tamanho legível', () => {
  expect(formatSize(0)).toBe('0 MB')
  expect(formatSize(1_500_000)).toBe('1,4 MB')
  expect(formatSize(250 * 1024 * 1024)).toBe('250 MB')
  expect(formatSize(3 * 1024 * 1024 * 1024)).toBe('3,0 GB')
})

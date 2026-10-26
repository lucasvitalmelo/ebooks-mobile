import { redirectSystemPath } from '@/app/+native-intent'

test('arquivo aberto com o app frio vai para a Biblioteca', () => {
  expect(redirectSystemPath({ path: 'content://com.android.providers/document/1', initial: true })).toBe('/')
  expect(redirectSystemPath({ path: 'file:///sdcard/livro.epub', initial: true })).toBe('/')
})

test('arquivo aberto com o app já aberto mantém a tela atual', () => {
  expect(redirectSystemPath({ path: 'content://com.android.providers/document/1', initial: false })).toBeNull()
})

test('links do app seguem como rota', () => {
  expect(redirectSystemPath({ path: 'ebooks://book/abc', initial: true })).toBe('ebooks://book/abc')
  expect(redirectSystemPath({ path: 'ebooks://book/abc', initial: false })).toBe('ebooks://book/abc')
})

import { exportFileName } from './export-name'

test.each([
  [{ title: 'O Relógio', author: 'Joana Vieira' }, 'O Relógio - Joana Vieira.epub'],
  [{ title: 'A/B: C?', author: '' }, 'AB C.epub'],
  [{ title: 'C:\\Livros\\Um', author: 'x' }, 'CLivrosUm - x.epub'],
  [{ title: '  muitos   espaços ', author: 'x' }, 'muitos espaços - x.epub'],
  [{ title: '', author: '' }, 'livro.epub'],
  [{ title: 'a'.repeat(200), author: '' }, `${'a'.repeat(120)}.epub`],
])('%j → %s', (book, expected) => {
  expect(exportFileName(book)).toBe(expected)
})

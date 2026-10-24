// Caracteres que Windows, macOS ou Android recusam num nome de arquivo.
const UNSAFE_IN_FILE_NAME = /[\\/:*?"<>|\p{Cc}]/gu

export function exportFileName(book: { title: string; author: string }): string {
  const clean = (text: string) => text.replace(UNSAFE_IN_FILE_NAME, '').replace(/\s+/g, ' ').trim()
  const name = [clean(book.title), clean(book.author)].filter(Boolean).join(' - ') || 'livro'
  return `${name.slice(0, 120)}.epub`
}

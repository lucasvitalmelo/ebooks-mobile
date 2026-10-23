import { currentEntry, flattenToc } from './toc'

const nav = [
  { label: ' Capítulo 1 ', href: 'cap1.xhtml' },
  {
    label: 'Capítulo 3',
    href: 'cap3.xhtml',
    subitems: [
      { label: '3.1', href: 'cap3.xhtml#sec-3-1' },
      { label: '3.2', href: 'cap3.xhtml#sec-3-2' },
    ],
  },
  { label: 'Notas', href: 'Text/notas.xhtml' },
]

test('achata com profundidade e tira espaços', () => {
  expect(flattenToc(nav)).toEqual([
    { label: 'Capítulo 1', href: 'cap1.xhtml', depth: 0 },
    { label: 'Capítulo 3', href: 'cap3.xhtml', depth: 0 },
    { label: '3.1', href: 'cap3.xhtml#sec-3-1', depth: 1 },
    { label: '3.2', href: 'cap3.xhtml#sec-3-2', depth: 1 },
    { label: 'Notas', href: 'Text/notas.xhtml', depth: 0 },
  ])
})

test('capítulo atual é a primeira entrada daquele arquivo', () => {
  const entries = flattenToc(nav)
  expect(currentEntry(entries, 'cap3.xhtml')).toBe(1)
  expect(currentEntry(entries, './Text/notas.xhtml')).toBe(4)
  expect(currentEntry(entries, 'cap2.xhtml')).toBe(-1)
  expect(currentEntry(entries, null)).toBe(-1)
})

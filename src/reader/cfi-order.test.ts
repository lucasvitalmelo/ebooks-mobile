import { byBookOrder, cfiSteps, compareCfi, containsCfi, showsSaved } from './cfi-order'

test('a página ainda mostra a posição salva: não grava de novo', () => {
  const page = { cfi: 'epubcfi(/6/4!/4/4/1:0)', startCfi: 'epubcfi(/6/4!/4/2/1:0)', endCfi: 'epubcfi(/6/4!/4/8/1:40)' }
  expect(showsSaved('epubcfi(/6/4!/4/4/1:10)', page)).toBe(true)
  expect(showsSaved('epubcfi(/6/4!/4/10/1:0)', page)).toBe(false)
  expect(showsSaved(null, page)).toBe(false)
  // Sem o começo, conta a âncora.
  expect(showsSaved(page.cfi, { cfi: page.cfi, startCfi: null, endCfi: null })).toBe(true)
})

test('lê os passos de um CFI simples e de um intervalo', () => {
  expect(cfiSteps('epubcfi(/6/4[cap2]!/4/2/1:12)')).toEqual([6, 4, 4, 2, 1, 12])
  expect(cfiSteps('epubcfi(/6/4!/4,/2/1:3,/2/1:9)')).toEqual([6, 4, 4, 2, 1, 3])
})

test('compara pela posição no livro', () => {
  expect(compareCfi('epubcfi(/6/2!/4/1:0)', 'epubcfi(/6/4!/4/1:0)')).toBeLessThan(0)
  expect(compareCfi('epubcfi(/6/4!/4/1:30)', 'epubcfi(/6/4!/4/1:5)')).toBeGreaterThan(0)
  expect(compareCfi('epubcfi(/6/4!/4/1:5)', 'epubcfi(/6/4!/4/1:5)')).toBe(0)
  expect(compareCfi('epubcfi(/6/4!/4/10/1:0)', 'epubcfi(/6/4!/4/2/1:0)')).toBeGreaterThan(0)
})

test('ordena na ordem do livro, empate pela criação', () => {
  const items = [
    { id: 'c', cfiRange: 'epubcfi(/6/4!/4,/1:0,/1:5)', createdAt: 1 },
    { id: 'a', cfiRange: 'epubcfi(/6/2!/4,/1:0,/1:5)', createdAt: 3 },
    { id: 'b', cfiRange: 'epubcfi(/6/2!/4,/1:0,/1:5)', createdAt: 4 },
  ]
  expect(byBookOrder(items).map((h) => h.id)).toEqual(['a', 'b', 'c'])
})

test('diz se um CFI está entre o começo e o fim da página', () => {
  const start = 'epubcfi(/6/4!/4/2/1:0)'
  const end = 'epubcfi(/6/4!/4/8/1:40)'
  expect(containsCfi(start, end, 'epubcfi(/6/4!/4/4/1:10)')).toBe(true)
  expect(containsCfi(start, end, start)).toBe(true)
  expect(containsCfi(start, end, end)).toBe(true)
  expect(containsCfi(start, end, 'epubcfi(/6/4!/4/10/1:0)')).toBe(false)
  expect(containsCfi(start, end, 'epubcfi(/6/2!/4/2/1:0)')).toBe(false)
  expect(containsCfi(start, null, start)).toBe(true)
  expect(containsCfi(start, null, 'epubcfi(/6/4!/4/4/1:10)')).toBe(false)
})

test('com a âncora no meio da página, conta o começo real da página', () => {
  const pageStart = 'epubcfi(/6/4!/4/2/1:0)'
  const anchor = 'epubcfi(/6/4!/4/6/1:0)'
  const end = 'epubcfi(/6/4!/4/8/1:40)'
  const origin = 'epubcfi(/6/4!/4/4/1:10)'
  expect(containsCfi(anchor, end, origin)).toBe(false)
  expect(containsCfi(pageStart, end, origin)).toBe(true)
})

import { byBookOrder, cfiSteps, compareCfi } from './cfi-order'

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

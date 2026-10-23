import { shouldHideBar } from './bar'

test('a primeira posição (a restaurada) não esconde a barra', () => {
  expect(shouldHideBar(null, 'epubcfi(/6/2)')).toBe(false)
})

test('a mesma posição de novo (locations prontas) não esconde', () => {
  expect(shouldHideBar('epubcfi(/6/2)', 'epubcfi(/6/2)')).toBe(false)
})

test('outra posição é um virar de página e esconde', () => {
  expect(shouldHideBar('epubcfi(/6/2)', 'epubcfi(/6/4)')).toBe(true)
})

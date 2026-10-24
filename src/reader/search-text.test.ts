import { groupByChapter, splitMatch } from './search-text'

test('separa a primeira ocorrência, sem diferenciar maiúsculas', () => {
  expect(splitMatch('...o Relógio parou e o relógio...', 'relógio')).toEqual({
    before: '...o ',
    match: 'Relógio',
    after: ' parou e o relógio...',
  })
})

test('sem ocorrência, tudo vai para o começo', () => {
  expect(splitMatch('nada aqui', 'xyz')).toEqual({ before: 'nada aqui', match: '', after: '' })
})

test('agrupa resultados seguidos do mesmo capítulo', () => {
  const r = (cfi: string, chapterLabel: string | null) => ({ cfi, excerpt: cfi, chapterLabel })
  expect(groupByChapter([r('a', 'C1'), r('b', 'C1'), r('c', null), r('d', 'C1')])).toEqual([
    { chapterLabel: 'C1', results: [r('a', 'C1'), r('b', 'C1')] },
    { chapterLabel: null, results: [r('c', null)] },
    { chapterLabel: 'C1', results: [r('d', 'C1')] },
  ])
})

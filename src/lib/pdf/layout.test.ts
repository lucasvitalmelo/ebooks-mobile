import { chapters, dropRunningLines, paragraphs, type Line, type PageText } from './layout'

const line = (text: string, top: number, height = 10): Line => ({ text, top, height })

test('junta linhas em parágrafos e abre um novo num espaço maior', () => {
  const lines = [
    line('Primeira linha do', 0),
    line('parágrafo um.', 12),
    line('Segundo parágrafo.', 40),
    line('Continua aqui.', 52),
  ]
  expect(paragraphs(lines)).toEqual(['Primeira linha do parágrafo um.', 'Segundo parágrafo. Continua aqui.'])
})

test('páginas curtas: o espaçamento típico vem do documento todo', () => {
  const page = (n: number): PageText => ({
    lines: [line(`Linha um ${n}`, 80), line(`linha dois ${n}.`, 95), line(`Outro parágrafo ${n}.`, 130)],
  })
  const [chapter] = chapters([1, 2, 3].map(page), [])
  expect(chapter.paragraphs).toEqual([
    'Linha um 1 linha dois 1.',
    'Outro parágrafo 1.',
    'Linha um 2 linha dois 2.',
    'Outro parágrafo 2.',
    'Linha um 3 linha dois 3.',
    'Outro parágrafo 3.',
  ])
})

test('paragraphs sem espaçamento informado usa a moda dos próprios espaços', () => {
  const lines = [line('a', 80), line('b.', 95), line('c', 130)]
  expect(paragraphs(lines)).toEqual(['a b.', 'c'])
  expect(paragraphs(lines, 15)).toEqual(['a b.', 'c'])
})

test('junta palavra hifenizada no fim da linha', () => {
  expect(paragraphs([line('uma pala-', 0), line('vra quebrada', 12)])).toEqual(['uma palavra quebrada'])
})

test('mantém o hífen antes de maiúscula', () => {
  expect(paragraphs([line('São Paulo-', 0), line('Rio', 12)])).toEqual(['São Paulo- Rio'])
})

test('tira número de página e cabeçalho repetido', () => {
  const page = (n: number): PageText => ({
    lines: [line('O Relógio Parado', 0), line(`Texto da página ${n}.`, 30), line(String(n), 80)],
  })
  const pages = [1, 2, 3, 4].map(page)
  expect(dropRunningLines(pages).map((p) => p.lines.map((l) => l.text))).toEqual([
    ['Texto da página 1.'],
    ['Texto da página 2.'],
    ['Texto da página 3.'],
    ['Texto da página 4.'],
  ])
})

test('tira "Página N" e "N de M" mesmo sem repetição', () => {
  const pages = [
    { lines: [line('Corpo', 30), line('Página 7', 80)] },
    { lines: [line('7 de 300', 0), line('Mais', 30)] },
  ]
  expect(dropRunningLines(pages).map((p) => p.lines.map((l) => l.text))).toEqual([['Corpo'], ['Mais']])
})

test('capítulos pelo sumário, com Início quando o primeiro não é a página 1', () => {
  const pages: PageText[] = [0, 1, 2, 3].map((n) => ({ lines: [line(`Página ${n} texto.`, 30)] }))
  const result = chapters(pages, [
    { title: 'Um', pageIndex: 1 },
    { title: 'Dois', pageIndex: 3 },
  ])
  expect(result.map((c) => c.title)).toEqual(['Início', 'Um', 'Dois'])
  expect(result[1].paragraphs).toEqual(['Página 1 texto.', 'Página 2 texto.'])
})

test('sem sumário, partes de 20 páginas', () => {
  const pages: PageText[] = Array.from({ length: 45 }, (_, n) => ({ lines: [line(`P${n}.`, 30)] }))
  expect(chapters(pages, []).map((c) => c.title)).toEqual(['Páginas 1–20', 'Páginas 21–40', 'Páginas 41–45'])
})

test('parágrafo sem ponto no fim da página continua na seguinte', () => {
  const pages: PageText[] = [{ lines: [line('uma frase que', 30)] }, { lines: [line('termina aqui.', 30)] }]
  expect(chapters(pages, [])[0].paragraphs).toEqual(['uma frase que termina aqui.'])
})

test('sumário com página fora do intervalo ou repetida é ignorado', () => {
  const pages: PageText[] = [0, 1].map((n) => ({ lines: [line(`T${n}.`, 30)] }))
  const result = chapters(pages, [
    { title: 'A', pageIndex: 0 },
    { title: 'A de novo', pageIndex: 0 },
    { title: 'Fora', pageIndex: 9 },
  ])
  expect(result.map((c) => c.title)).toEqual(['A'])
})

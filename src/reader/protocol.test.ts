import { PRESET_THEMES } from '@/lib/db/presets'
import { toReaderTheme } from '@/lib/db/themes'
import { Assembler, chunkMessage, parseCommand, parseEvent } from './protocol'

const theme = toReaderTheme(PRESET_THEMES[0])

const highlight = { id: 'h', cfiRange: 'epubcfi(/6/2!/4,/1:0,/1:5)' }

test('aceita comandos válidos', () => {
  expect(
    parseCommand(JSON.stringify({ type: 'open', base64: 'AAA', cfi: null, locations: null, highlights: [highlight] })),
  ).toEqual({ type: 'open', base64: 'AAA', cfi: null, locations: null, highlights: [highlight] })
  expect(parseCommand('{"type":"next"}')).toEqual({ type: 'next' })
  expect(parseCommand(JSON.stringify({ type: 'goTo', target: 'epubcfi(/6/2)' }))).toEqual({
    type: 'goTo',
    target: 'epubcfi(/6/2)',
  })
  expect(parseCommand(JSON.stringify({ type: 'goTo', target: 'cap3.xhtml#sec-3-2' }))).toEqual({
    type: 'goTo',
    target: 'cap3.xhtml#sec-3-2',
  })
  expect(parseCommand(JSON.stringify({ type: 'setTheme', theme }))).toEqual({ type: 'setTheme', theme })
  expect(parseCommand(JSON.stringify({ type: 'addHighlight', ...highlight }))).toEqual({
    type: 'addHighlight',
    ...highlight,
  })
  expect(parseCommand(JSON.stringify({ type: 'removeHighlight', id: 'h' }))).toEqual({
    type: 'removeHighlight',
    id: 'h',
  })
  expect(parseCommand('{"type":"clearSelection"}')).toEqual({ type: 'clearSelection' })
})

test('descarta comandos inválidos', () => {
  expect(parseCommand('não é json')).toBeNull()
  expect(parseCommand('{"type":"voar"}')).toBeNull()
  expect(parseCommand(JSON.stringify({ type: 'open', base64: 1, cfi: null, locations: null }))).toBeNull()
  expect(parseCommand(JSON.stringify({ type: 'setTheme', theme: { ...theme, fontFamily: 'comic-sans' } }))).toBeNull()
})

test('descarta comandos novos malformados', () => {
  expect(parseCommand(JSON.stringify({ type: 'open', base64: 'A', cfi: null, locations: null }))).toBeNull()
  expect(
    parseCommand(JSON.stringify({ type: 'open', base64: 'A', cfi: null, locations: null, highlights: [{ id: 1 }] })),
  ).toBeNull()
  expect(parseCommand(JSON.stringify({ type: 'goTo', target: '' }))).toBeNull()
  expect(parseCommand(JSON.stringify({ type: 'goTo', cfi: 'epubcfi(/6/2)' }))).toBeNull()
  expect(parseCommand(JSON.stringify({ type: 'addHighlight', id: 'h' }))).toBeNull()
  expect(parseCommand(JSON.stringify({ type: 'removeHighlight', id: '' }))).toBeNull()
})

test('aceita eventos válidos e descarta inválidos', () => {
  expect(parseEvent('{"type":"ready"}')).toEqual({ type: 'ready' })
  expect(
    parseEvent(
      JSON.stringify({
        type: 'relocated',
        cfi: 'epubcfi(/6/2)',
        percent: 0.5,
        href: 'cap1.xhtml',
        startCfi: null,
        endCfi: null,
      }),
    ),
  ).toEqual({
    type: 'relocated',
    cfi: 'epubcfi(/6/2)',
    percent: 0.5,
    href: 'cap1.xhtml',
    startCfi: null,
    endCfi: null,
  })
  expect(
    parseEvent(
      JSON.stringify({ type: 'relocated', cfi: 'x', percent: null, href: null, startCfi: null, endCfi: null }),
    ),
  ).toEqual({
    type: 'relocated',
    cfi: 'x',
    percent: null,
    href: null,
    startCfi: null,
    endCfi: null,
  })
  expect(parseEvent(JSON.stringify({ type: 'relocated', cfi: 'x', percent: 2, href: null }))).toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'relocated', cfi: 'x', percent: null }))).toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'locations', data: '[]' }))).toEqual({ type: 'locations', data: '[]' })
  expect(parseEvent('{"type":"centerTap"}')).toEqual({ type: 'centerTap' })
  expect(parseEvent(JSON.stringify({ type: 'error', message: 'falhou' }))).toEqual({ type: 'error', message: 'falhou' })
  expect(parseEvent('{"type":"error"}')).toBeNull()
})

const rect = { left: 10, top: 20, right: 110, bottom: 40 }

test('eventos novos', () => {
  const entries = [{ label: 'C1', href: 'cap1.xhtml', depth: 0 }]
  expect(parseEvent(JSON.stringify({ type: 'toc', entries }))).toEqual({ type: 'toc', entries })
  expect(parseEvent(JSON.stringify({ type: 'toc', entries: [{ label: 'C1', href: 'x', depth: -1 }] }))).toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'selection', cfiRange: 'epubcfi(/6/2)', text: 'olá', rect: null }))).toEqual(
    {
      type: 'selection',
      cfiRange: 'epubcfi(/6/2)',
      text: 'olá',
      rect: null,
    },
  )
  expect(parseEvent(JSON.stringify({ type: 'selection', cfiRange: null, text: '', rect: null }))).toEqual({
    type: 'selection',
    cfiRange: null,
    text: '',
    rect: null,
  })
  expect(parseEvent(JSON.stringify({ type: 'highlightTap', id: 'h', rect }))).toEqual({
    type: 'highlightTap',
    id: 'h',
    rect,
  })
  expect(parseEvent(JSON.stringify({ type: 'highlightTap' }))).toBeNull()
})

test('quebra e remonta mensagens grandes', () => {
  const message = 'x'.repeat(25) + 'ç'
  const chunks = chunkMessage(message, 10)
  expect(chunks).toHaveLength(3)
  const assembler = new Assembler()
  expect(assembler.push(chunks[0])).toBeNull()
  expect(assembler.push(chunks[1])).toBeNull()
  expect(assembler.push(chunks[2])).toBe(message)
})

test('mensagem pequena vai num pedaço só e cada mensagem tem id próprio', () => {
  const [a] = chunkMessage('{"type":"next"}')
  const [b] = chunkMessage('{"type":"next"}')
  expect(new Assembler().push(a)).toBe('{"type":"next"}')
  expect(a.id).not.toBe(b.id)
})

test('ignora pedaço malformado', () => {
  expect(new Assembler().push({ id: 1 })).toBeNull()
  expect(new Assembler().push('texto')).toBeNull()
})

test('openExternal só aceita http, https e mailto', () => {
  expect(parseEvent(JSON.stringify({ type: 'openExternal', url: 'https://exemplo.com/a' }))).toEqual({
    type: 'openExternal',
    url: 'https://exemplo.com/a',
  })
  expect(parseEvent(JSON.stringify({ type: 'openExternal', url: 'http://exemplo.com' }))).not.toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'openExternal', url: 'mailto:alguem@exemplo.com' }))).not.toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'openExternal', url: 'javascript:alert(1)' }))).toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'openExternal', url: 'file:///data/livro.epub' }))).toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'openExternal', url: 'capitulo2.xhtml#nota' }))).toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'openExternal' }))).toBeNull()
})

test('remonta pedaços fora de ordem', () => {
  const chunks = chunkMessage('abcdefghij', 4)
  const assembler = new Assembler()
  expect(assembler.push(chunks[2])).toBeNull()
  expect(assembler.push(chunks[0])).toBeNull()
  expect(assembler.push(chunks[1])).toBe('abcdefghij')
})

test('pedaço repetido não completa a mensagem antes da hora', () => {
  const chunks = chunkMessage('abcdefghij', 4)
  const assembler = new Assembler()
  expect(assembler.push(chunks[0])).toBeNull()
  expect(assembler.push(chunks[0])).toBeNull()
  expect(assembler.push(chunks[1])).toBeNull()
  expect(assembler.push(chunks[2])).toBe('abcdefghij')
})

test('descarta pedaços com índice ou total inválidos', () => {
  const assembler = new Assembler()
  const chunk = { id: 1, index: 0, total: 2, data: 'x' }
  expect(assembler.push({ ...chunk, index: 2 })).toBeNull()
  expect(assembler.push({ ...chunk, index: -1 })).toBeNull()
  expect(assembler.push({ ...chunk, index: 0.5 })).toBeNull()
  expect(assembler.push({ ...chunk, total: 1.5 })).toBeNull()
  expect(assembler.push({ ...chunk, id: 1.5 })).toBeNull()
  expect(assembler.push({ ...chunk, total: 10_001 })).toBeNull()
  expect(assembler.push({ ...chunk, data: 1 })).toBeNull()
  expect(assembler.push({ ...chunk, total: 1 })).toBe('x')
})

test('mensagem nova descarta a anterior que ficou pela metade', () => {
  const old = chunkMessage('abcdefgh', 4)
  const newer = chunkMessage('12345678', 4)
  const assembler = new Assembler()
  expect(assembler.push(old[0])).toBeNull()
  expect(assembler.push(newer[0])).toBeNull()
  expect(assembler.push(old[1])).toBeNull()
  expect(assembler.push(newer[1])).toBe('12345678')
})

test('eventos da v0.3', () => {
  expect(
    parseEvent(
      JSON.stringify({ type: 'relocated', cfi: 'a', percent: 0.1, href: 'c.xhtml', startCfi: 's', endCfi: 'b' }),
    ),
  ).toEqual({
    type: 'relocated',
    cfi: 'a',
    percent: 0.1,
    href: 'c.xhtml',
    startCfi: 's',
    endCfi: 'b',
  })
  // Sem o começo da página, o evento é recusado (a página sempre manda, mesmo nulo).
  expect(
    parseEvent(JSON.stringify({ type: 'relocated', cfi: 'a', percent: 0.1, href: 'c.xhtml', endCfi: 'b' })),
  ).toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'relocated', cfi: 'a', percent: null, href: null }))).toBeNull()
  expect(parseEvent('{"type":"linkJump"}')).toEqual({ type: 'linkJump' })
  expect(parseEvent(JSON.stringify({ type: 'jumpEnded', ok: true }))).toEqual({ type: 'jumpEnded', ok: true })
  expect(parseEvent(JSON.stringify({ type: 'jumpEnded' }))).toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'selection', cfiRange: 'x', text: 't', rect }))).toEqual({
    type: 'selection',
    cfiRange: 'x',
    text: 't',
    rect,
  })
  expect(parseEvent(JSON.stringify({ type: 'selection', cfiRange: 'x', text: 't', rect: { left: 1 } }))).toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'highlightTap', id: 'h', rect }))).toEqual({
    type: 'highlightTap',
    id: 'h',
    rect,
  })
  expect(parseEvent(JSON.stringify({ type: 'highlightTap', id: 'h' }))).toBeNull()
})

test('busca', () => {
  expect(parseCommand(JSON.stringify({ type: 'search', id: 3, query: 'relógio' }))).toEqual({
    type: 'search',
    id: 3,
    query: 'relógio',
  })
  expect(parseCommand(JSON.stringify({ type: 'search', id: '3', query: 'x' }))).toBeNull()
  const results = [{ cfi: 'epubcfi(/6/2)', excerpt: '...o relógio...', chapterLabel: 'C1' }]
  expect(parseEvent(JSON.stringify({ type: 'searchResults', id: 3, results }))).toEqual({
    type: 'searchResults',
    id: 3,
    results,
  })
  expect(
    parseEvent(
      JSON.stringify({ type: 'searchResults', id: 3, results: [{ cfi: 'x', excerpt: 'y', chapterLabel: null }] }),
    ),
  ).toEqual({
    type: 'searchResults',
    id: 3,
    results: [{ cfi: 'x', excerpt: 'y', chapterLabel: null }],
  })
  expect(parseEvent(JSON.stringify({ type: 'searchResults', id: 3, results: [{ cfi: 'x' }] }))).toBeNull()
})

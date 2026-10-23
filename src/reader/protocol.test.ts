import { PRESET_THEMES } from '@/lib/db/presets'
import { toReaderTheme } from '@/lib/db/themes'
import { Assembler, chunkMessage, parseCommand, parseEvent } from './protocol'

const theme = toReaderTheme(PRESET_THEMES[0])

test('aceita comandos válidos', () => {
  expect(parseCommand(JSON.stringify({ type: 'open', base64: 'AAA', cfi: null, locations: null }))).toEqual({
    type: 'open',
    base64: 'AAA',
    cfi: null,
    locations: null,
  })
  expect(parseCommand('{"type":"next"}')).toEqual({ type: 'next' })
  expect(parseCommand(JSON.stringify({ type: 'goTo', cfi: 'epubcfi(/6/2)' }))).toEqual({
    type: 'goTo',
    cfi: 'epubcfi(/6/2)',
  })
  expect(parseCommand(JSON.stringify({ type: 'setTheme', theme }))).toEqual({ type: 'setTheme', theme })
})

test('descarta comandos inválidos', () => {
  expect(parseCommand('não é json')).toBeNull()
  expect(parseCommand('{"type":"voar"}')).toBeNull()
  expect(parseCommand(JSON.stringify({ type: 'open', base64: 1, cfi: null, locations: null }))).toBeNull()
  expect(parseCommand(JSON.stringify({ type: 'setTheme', theme: { ...theme, fontFamily: 'comic-sans' } }))).toBeNull()
})

test('aceita eventos válidos e descarta inválidos', () => {
  expect(parseEvent('{"type":"ready"}')).toEqual({ type: 'ready' })
  expect(parseEvent(JSON.stringify({ type: 'relocated', cfi: 'epubcfi(/6/2)', percent: 0.5 }))).toEqual({
    type: 'relocated',
    cfi: 'epubcfi(/6/2)',
    percent: 0.5,
  })
  expect(parseEvent(JSON.stringify({ type: 'relocated', cfi: 'x', percent: null }))).toEqual({
    type: 'relocated',
    cfi: 'x',
    percent: null,
  })
  expect(parseEvent(JSON.stringify({ type: 'relocated', cfi: 'x', percent: 2 }))).toBeNull()
  expect(parseEvent(JSON.stringify({ type: 'locations', data: '[]' }))).toEqual({ type: 'locations', data: '[]' })
  expect(parseEvent('{"type":"centerTap"}')).toEqual({ type: 'centerTap' })
  expect(parseEvent(JSON.stringify({ type: 'error', message: 'falhou' }))).toEqual({ type: 'error', message: 'falhou' })
  expect(parseEvent('{"type":"error"}')).toBeNull()
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

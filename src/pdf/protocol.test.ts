import { parsePdfCommand, parsePdfEvent } from './protocol'

test('comandos', () => {
  expect(parsePdfCommand(JSON.stringify({ type: 'convert', id: 1, base64: 'JVBER' }))).toEqual({
    type: 'convert',
    id: 1,
    base64: 'JVBER',
  })
  expect(parsePdfCommand(JSON.stringify({ type: 'convert', id: '1', base64: 'x' }))).toBeNull()
})

test('eventos', () => {
  expect(parsePdfEvent('{"type":"ready"}')).toEqual({ type: 'ready' })
  expect(parsePdfEvent(JSON.stringify({ type: 'progress', id: 1, page: 2, total: 9 }))).toEqual({
    type: 'progress',
    id: 1,
    page: 2,
    total: 9,
  })
  const result = {
    type: 'pdfResult',
    id: 1,
    title: 'T',
    author: null,
    modified: '2020-01-02T03:04:05Z',
    outline: [{ title: 'C', pageIndex: 0 }],
    cover: null,
    pageCount: 3,
  }
  expect(parsePdfEvent(JSON.stringify(result))).toEqual(result)
  expect(parsePdfEvent(JSON.stringify({ ...result, pageCount: 'x' }))).toBeNull()
  expect(parsePdfEvent(JSON.stringify({ ...result, modified: 5 }))).toBeNull()
  expect(parsePdfEvent(JSON.stringify({ type: 'pdfError', id: 1, message: 'x' }))).toEqual({
    type: 'pdfError',
    id: 1,
    message: 'x',
  })
})

test('pageText', () => {
  const event = { type: 'pageText', id: 1, index: 0, lines: [{ text: 'a', top: 1, height: 2 }] }
  expect(parsePdfEvent(JSON.stringify(event))).toEqual(event)
  expect(parsePdfEvent(JSON.stringify({ ...event, lines: [{ text: 1 }] }))).toBeNull()
  expect(parsePdfEvent(JSON.stringify({ ...event, index: 'x' }))).toBeNull()
})

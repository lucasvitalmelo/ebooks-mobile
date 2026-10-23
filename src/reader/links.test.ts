import { resolveLink } from './links'

test.each([
  ['cap3.xhtml#sec-3-2', '/OEBPS/cap1.xhtml', { kind: 'internal', path: '/OEBPS/cap3.xhtml', hash: '#sec-3-2' }],
  ['notas.xhtml#n1', '/OEBPS/cap1.xhtml', { kind: 'internal', path: '/OEBPS/notas.xhtml', hash: '#n1' }],
  ['#n2', '/OEBPS/notas.xhtml', { kind: 'internal', path: '/OEBPS/notas.xhtml', hash: '#n2' }],
  ['../Text/c.xhtml', '/OEBPS/x/cap.xhtml', { kind: 'internal', path: '/OEBPS/Text/c.xhtml', hash: '' }],
  ['cap%C3%ADtulo%201.xhtml', '/OEBPS/cap1.xhtml', { kind: 'internal', path: '/OEBPS/capítulo 1.xhtml', hash: '' }],
  ['cap2.xhtml', 'OEBPS/cap1.xhtml', { kind: 'internal', path: '/OEBPS/cap2.xhtml', hash: '' }],
  ['https://example.com/', '/OEBPS/cap1.xhtml', { kind: 'external', url: 'https://example.com/' }],
  ['mailto:a@b.com', '/OEBPS/cap1.xhtml', { kind: 'external', url: 'mailto:a@b.com' }],
])('%s em %s', (href, section, expected) => {
  expect(resolveLink(href, section)).toEqual(expected)
})

test.each(['', '   ', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x'])('ignora %j', (href) => {
  expect(resolveLink(href, '/OEBPS/cap1.xhtml')).toBeNull()
})

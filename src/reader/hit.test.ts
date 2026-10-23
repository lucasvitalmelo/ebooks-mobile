import { hitHighlight } from './hit'

const items = [
  {
    id: 'a',
    rects: [
      { left: 10, top: 10, right: 100, bottom: 30 },
      { left: 10, top: 30, right: 60, bottom: 50 },
    ],
  },
  { id: 'b', rects: [{ left: 200, top: 10, right: 300, bottom: 30 }] },
]

test.each([
  [50, 20, 'a'],
  [40, 45, 'a'],
  [250, 15, 'b'],
  [80, 45, null],
  [150, 20, null],
  [8, 20, 'a'],
])('(%d, %d) → %s', (x, y, expected) => {
  expect(hitHighlight(x, y, items)).toBe(expected)
})

test('o último grifo desenhado ganha quando dois se sobrepõem', () => {
  const overlap = [...items, { id: 'c', rects: [{ left: 40, top: 15, right: 70, bottom: 25 }] }]
  expect(hitHighlight(50, 20, overlap)).toBe('c')
})

test('sem grifos, nada', () => {
  expect(hitHighlight(50, 20, [])).toBeNull()
})

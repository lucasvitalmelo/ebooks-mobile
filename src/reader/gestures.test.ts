import { classifyGesture } from './gestures'

const width = 400

test.each([
  [{ dx: -80, dy: 5, x: 200 }, 'next'],
  [{ dx: 80, dy: -10, x: 200 }, 'prev'],
  [{ dx: 2, dy: 3, x: 50 }, 'prev'],
  [{ dx: 0, dy: 0, x: 350 }, 'next'],
  [{ dx: 0, dy: 0, x: 200 }, 'centerTap'],
  [{ dx: 10, dy: 120, x: 200 }, null],
  [{ dx: 25, dy: 0, x: 200 }, null],
])('%j → %s', (gesture, expected) => {
  expect(classifyGesture({ ...gesture, width, duration: 120 })).toBe(expected)
})

test('toque longo não é toque', () => {
  expect(classifyGesture({ dx: 0, dy: 0, x: 350, width, duration: 600 })).toBeNull()
  expect(classifyGesture({ dx: 0, dy: 0, x: 200, width, duration: 600 })).toBeNull()
})

test('deslize lento continua sendo deslize', () => {
  expect(classifyGesture({ dx: -80, dy: 0, x: 200, width, duration: 900 })).toBe('next')
})

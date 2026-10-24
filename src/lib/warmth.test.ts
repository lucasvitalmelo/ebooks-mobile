import { WARMTH_COLOR, warmthOpacity } from './warmth'

test.each([
  [0, 0],
  [50, 0.175],
  [100, 0.35],
  [150, 0.35],
  [-10, 0],
])('%d%% → opacidade %d', (value, expected) => {
  expect(warmthOpacity(value)).toBeCloseTo(expected, 5)
})

test('cor âmbar', () => {
  expect(WARMTH_COLOR).toBe('rgb(255,138,0)')
})

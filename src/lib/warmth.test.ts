import { LEGACY_WARMTH_COLOR, legacyWarmthOpacity, warmthColor } from './warmth'

test.each([
  [0, 'rgb(255,255,255)'],
  [50, 'rgb(255,227,191)'],
  [100, 'rgb(255,199,128)'],
  [150, 'rgb(255,199,128)'],
  [-10, 'rgb(255,255,255)'],
])('%d%% → %s', (percent, expected) => {
  expect(warmthColor(percent)).toBe(expected)
})

test.each([
  [0, 0],
  [50, 0.175],
  [100, 0.35],
  [150, 0.35],
  [-10, 0],
])('Android antigo: %d%% → opacidade %d', (percent, expected) => {
  expect(legacyWarmthOpacity(percent)).toBeCloseTo(expected, 5)
})

test('Android antigo: cor âmbar', () => {
  expect(LEGACY_WARMTH_COLOR).toBe('rgb(255,138,0)')
})

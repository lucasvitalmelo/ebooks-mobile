import { PRESET_THEMES } from '@/lib/db/presets'
import { toReaderTheme } from '@/lib/db/themes'
import { fontCss } from './fonts'
import { themeCss } from './theme-css'

test('monta o CSS do tema com cores, fonte e entrelinha', () => {
  const theme = { ...toReaderTheme(PRESET_THEMES[0]), lineHeight: 1.7, fontFamily: 'lora' as const }
  const css = themeCss(theme)
  expect(css).toContain(`background: ${theme.background} !important`)
  expect(css).toContain(`color: ${theme.text} !important`)
  expect(css).toContain(`font-family: ${fontCss('lora')} !important`)
  expect(css).toContain('line-height: 1.7 !important')
  expect(css).toMatch(new RegExp(`a \{[^}]*color: ${theme.link} !important`))
})

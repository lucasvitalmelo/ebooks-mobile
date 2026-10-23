export const FONTS = [
  { id: 'nunito', label: 'Nunito', css: "'Nunito', sans-serif" },
  { id: 'quicksand', label: 'Quicksand', css: "'Quicksand', sans-serif" },
  { id: 'comfortaa', label: 'Comfortaa', css: "'Comfortaa', sans-serif" },
  { id: 'poppins', label: 'Poppins', css: "'Poppins', sans-serif" },
  { id: 'inter', label: 'Inter', css: "'Inter', sans-serif" },
  { id: 'literata', label: 'Literata', css: "'Literata', serif" },
  { id: 'lora', label: 'Lora', css: "'Lora', serif" },
  { id: 'merriweather', label: 'Merriweather', css: "'Merriweather', serif" },
] as const

export type FontId = (typeof FONTS)[number]['id']

export function isFontId(value: unknown): value is FontId {
  return FONTS.some((font) => font.id === value)
}

export function fontCss(id: FontId): string {
  return FONTS.find((font) => font.id === id)?.css ?? 'serif'
}

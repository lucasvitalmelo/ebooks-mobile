import type { Theme } from './themes'

const BASE = { fontSize: 18, margin: 24, builtin: true } as const

export const PRESET_THEMES: Theme[] = [
  {
    ...BASE,
    id: 'preset-claro',
    name: 'Claro',
    background: '#ffffff',
    text: '#1f1f1f',
    link: '#2563eb',
    fontFamily: 'nunito',
    lineHeight: 1.6,
  },
  {
    ...BASE,
    id: 'preset-escuro',
    name: 'Escuro',
    background: '#1a1a1f',
    text: '#e4e4e7',
    link: '#93c5fd',
    fontFamily: 'nunito',
    lineHeight: 1.6,
  },
  {
    ...BASE,
    id: 'preset-sepia',
    name: 'Sépia',
    background: '#f4ecd8',
    text: '#3b3428',
    link: '#8a5a2b',
    fontFamily: 'nunito',
    lineHeight: 1.6,
  },
  {
    ...BASE,
    id: 'preset-rosa',
    name: 'Rosa Pastel',
    background: '#fdf2f6',
    text: '#4a2f3a',
    link: '#b4466f',
    fontFamily: 'quicksand',
    lineHeight: 1.7,
  },
  {
    ...BASE,
    id: 'preset-lavanda',
    name: 'Lavanda',
    background: '#f5f1fb',
    text: '#3c3352',
    link: '#6d4fb3',
    fontFamily: 'comfortaa',
    lineHeight: 1.7,
  },
  {
    ...BASE,
    id: 'preset-menta',
    name: 'Menta',
    background: '#f1faf6',
    text: '#254238',
    link: '#1f7a5c',
    fontFamily: 'poppins',
    lineHeight: 1.7,
  },
]

export const DEFAULT_THEME_ID = 'preset-claro'

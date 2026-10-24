import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { Db } from '@/lib/db/db'
import { DEFAULT_THEME_ID, PRESET_THEMES } from '@/lib/db/presets'
import { getSetting, setSetting } from '@/lib/db/settings'
import { deleteTheme, listThemes, saveTheme, type Theme } from '@/lib/db/themes'
import type { ReaderTheme } from '@/reader/theme'

export const LIMITS = {
  fontSize: { min: 12, max: 32, step: 1 },
  lineHeight: { min: 1.2, max: 2.2, step: 0.1 },
  margin: { min: 8, max: 48, step: 4 },
} as const

export function adjust(value: number, direction: 1 | -1, limits: { min: number; max: number; step: number }): number {
  const next = Math.round((value + direction * limits.step) * 10) / 10
  return Math.min(limits.max, Math.max(limits.min, next))
}

export type ThemePatch = Partial<ReaderTheme> | ((theme: Theme) => Partial<ReaderTheme>)

interface ThemeState {
  themes: Theme[]
  active: Theme
  keepAwake: boolean
  warmth: number
  warmthPreview: number | null
  // null: o brilho do sistema. Valor de 0 a 100 (ver lib/brightness).
  brightness: number | null
  brightnessPreview: number | null
  // Sobe o progresso para o Drive enquanto se lê, sem esperar sair do livro.
  syncWhileReading: boolean
  setWarmthPreview(value: number | null): void
  setBrightnessPreview(value: number | null): void
  load(db: Db): Promise<void>
  select(db: Db, id: string): Promise<void>
  update(db: Db, patch: ThemePatch): Promise<void>
  remove(db: Db, id: string): Promise<void>
  setKeepAwake(db: Db, value: boolean): Promise<void>
  setWarmth(db: Db, value: number): Promise<void>
  setBrightness(db: Db, value: number | null): Promise<void>
  setSyncWhileReading(db: Db, value: boolean): Promise<void>
}

function uniqueId(themes: Theme[], base: string): string {
  let id = base
  for (let n = 2; themes.some((t) => t.id === id); n++) id = `${base}-${n}`
  return id
}

export function createThemeStore(now: () => number = Date.now) {
  // Cada operação lê o estado e depois grava; ajustes seguidos (sliders, paleta) as sobreporiam
  // (dois ajustes num tema pronto criariam duas cópias), então rodam uma de cada vez.
  let queue: Promise<unknown> = Promise.resolve()
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task)
    queue = result.catch(() => {})
    return result
  }

  return createStore<ThemeState>()((set, get) => ({
    themes: PRESET_THEMES,
    active: PRESET_THEMES[0],
    keepAwake: false,
    warmth: 0,
    warmthPreview: null,
    brightness: null,
    brightnessPreview: null,
    syncWhileReading: true,
    setWarmthPreview: (value) => set({ warmthPreview: value }),
    setBrightnessPreview: (value) => set({ brightnessPreview: value }),

    load: (db) =>
      serial(async () => {
        const themes = await listThemes(db)
        const activeId = (await getSetting(db, 'activeThemeId')) ?? DEFAULT_THEME_ID
        const keepAwake = (await getSetting(db, 'keepAwake')) === '1'
        const warmth = Number((await getSetting(db, 'warmth')) ?? 0) || 0
        const storedBrightness = await getSetting(db, 'brightness')
        const brightness =
          storedBrightness === null || storedBrightness === 'system' ? null : Number(storedBrightness) || 0
        const syncWhileReading = (await getSetting(db, 'syncWhileReading')) !== '0'
        set({
          themes,
          active: themes.find((t) => t.id === activeId) ?? themes[0],
          keepAwake,
          warmth,
          brightness,
          syncWhileReading,
        })
      }),

    select: (db, id) =>
      serial(async () => {
        const theme = get().themes.find((t) => t.id === id)
        if (!theme) return
        await setSetting(db, 'activeThemeId', id)
        set({ active: theme })
      }),

    update: (db, patch) =>
      serial(async () => {
        const { active, themes } = get()
        // A função roda aqui, na fila, sobre o tema ativo de agora, não sobre o de um render antigo.
        const fields = typeof patch === 'function' ? patch(active) : patch
        const changed = (Object.keys(fields) as (keyof ReaderTheme)[]).some((key) => fields[key] !== active[key])
        if (!changed) return
        // Tema pronto não se edita: o primeiro ajuste cria uma cópia do usuário.
        const next: Theme = active.builtin
          ? {
              ...active,
              ...fields,
              id: uniqueId(themes, `custom-${now().toString(36)}`),
              name: `${active.name} (meu)`,
              builtin: false,
            }
          : { ...active, ...fields }
        await saveTheme(db, next)
        if (active.builtin) await setSetting(db, 'activeThemeId', next.id)
        set({
          active: next,
          themes: active.builtin ? [...themes, next] : themes.map((t) => (t.id === next.id ? next : t)),
        })
      }),

    remove: (db, id) =>
      serial(async () => {
        await deleteTheme(db, id)
        const themes = get().themes.filter((t) => t.id !== id)
        if (get().active.id === id) {
          await setSetting(db, 'activeThemeId', DEFAULT_THEME_ID)
          set({ themes, active: themes.find((t) => t.id === DEFAULT_THEME_ID) ?? themes[0] })
        } else {
          set({ themes })
        }
      }),

    setKeepAwake: (db, value) =>
      serial(async () => {
        await setSetting(db, 'keepAwake', value ? '1' : '0')
        set({ keepAwake: value })
      }),

    setWarmth: (db, value) =>
      serial(async () => {
        await setSetting(db, 'warmth', String(value))
        set({ warmth: value })
      }),

    setBrightness: (db, value) =>
      serial(async () => {
        await setSetting(db, 'brightness', value === null ? 'system' : String(value))
        set({ brightness: value })
      }),

    setSyncWhileReading: (db, value) =>
      serial(async () => {
        await setSetting(db, 'syncWhileReading', value ? '1' : '0')
        set({ syncWhileReading: value })
      }),
  }))
}

export const themeStore = createThemeStore()

export function useThemeStore<T>(selector: (state: ThemeState) => T): T {
  return useStore(themeStore, selector)
}

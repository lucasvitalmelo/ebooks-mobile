import { migrate } from '@/lib/db/migrations'
import { PRESET_THEMES } from '@/lib/db/presets'
import { getSetting } from '@/lib/db/settings'
import { getTheme } from '@/lib/db/themes'
import { openTestDb } from '@/lib/db/testing/node-db'
import { adjust, createThemeStore, LIMITS } from './theme-store'

async function setup() {
  const db = openTestDb()
  await migrate(db)
  const store = createThemeStore(() => 1234)
  await store.getState().load(db)
  return { db, store }
}

test('carrega com o tema padrão ativo', async () => {
  const { store } = await setup()
  expect(store.getState().active.id).toBe('preset-claro')
  expect(store.getState().themes).toHaveLength(PRESET_THEMES.length)
})

test('escolher um tema grava a escolha', async () => {
  const { db, store } = await setup()
  await store.getState().select(db, 'preset-sepia')
  expect(store.getState().active.id).toBe('preset-sepia')
  expect(await getSetting(db, 'activeThemeId')).toBe('preset-sepia')
})

test('ajustar um tema pronto cria uma cópia e a ativa', async () => {
  const { db, store } = await setup()
  await store.getState().update(db, { fontSize: 22 })
  const active = store.getState().active
  expect(active).toMatchObject({ id: 'custom-ya', name: 'Claro (meu)', builtin: false, fontSize: 22 })
  expect(await getTheme(db, 'preset-claro')).toMatchObject({ fontSize: 18 })
  await store.getState().update(db, { margin: 32 })
  expect(store.getState().themes.filter((t) => !t.builtin)).toHaveLength(1)
  expect(await getTheme(db, active.id)).toMatchObject({ fontSize: 22, margin: 32 })
})

test('dois ajustes simultâneos num tema pronto criam uma só cópia com os dois', async () => {
  const { db } = await setup()
  // Relógio que muda a cada chamada: sem serialização, cada ajuste criaria uma cópia de id diferente.
  let tick = 0
  const racing = createThemeStore(() => ++tick)
  await racing.getState().load(db)
  await Promise.all([racing.getState().update(db, { fontSize: 22 }), racing.getState().update(db, { margin: 32 })])
  const custom = racing.getState().themes.filter((t) => !t.builtin)
  expect(custom).toHaveLength(1)
  expect(racing.getState().active).toMatchObject({ fontSize: 22, margin: 32 })
  expect(await getTheme(db, custom[0].id)).toMatchObject({ fontSize: 22, margin: 32 })
  expect(await getTheme(db, 'preset-claro')).toMatchObject({ fontSize: 18, margin: 24 })
})

test('um ajuste que falha não trava os seguintes', async () => {
  const { db, store } = await setup()
  const broken = { ...db, run: () => Promise.reject(new Error('disco cheio')) }
  await expect(store.getState().update(broken, { fontSize: 22 })).rejects.toThrow('disco cheio')
  await store.getState().update(db, { fontSize: 20 })
  expect(store.getState().active.fontSize).toBe(20)
})

test('ajustes por função são resolvidos na fila, sobre o tema ativo naquele momento', async () => {
  const { db, store } = await setup()
  const plusOne = (t: { fontSize: number }) => ({ fontSize: adjust(t.fontSize, 1, LIMITS.fontSize) })
  await Promise.all([store.getState().update(db, plusOne), store.getState().update(db, plusOne)])
  expect(store.getState().active.fontSize).toBe(20)
})

test('ajuste logo após escolher outro tema, sem esperar, parte do tema escolhido', async () => {
  const { db, store } = await setup()
  const plusOne = (t: { fontSize: number }) => ({ fontSize: t.fontSize + 1 })
  void store.getState().select(db, 'preset-escuro')
  await store.getState().update(db, plusOne)
  expect(store.getState().active).toMatchObject({ name: 'Escuro (meu)', background: '#1a1a1f', fontSize: 19 })
})

test('ajuste sem mudança não cria cópia nem grava', async () => {
  const { db, store } = await setup()
  await store.getState().update(db, { fontFamily: 'nunito', fontSize: 18 })
  await store.getState().update(db, () => ({}))
  expect(store.getState().active.id).toBe('preset-claro')
  expect(store.getState().themes).toHaveLength(PRESET_THEMES.length)
  expect(await getSetting(db, 'activeThemeId')).toBeNull()
  await store.getState().update(db, { fontSize: 20 })
  const id = store.getState().active.id
  await store.getState().update(db, { fontSize: 20 })
  expect(store.getState().active.id).toBe(id)
  expect(store.getState().themes.filter((t) => !t.builtin)).toHaveLength(1)
})

test('cópias criadas no mesmo instante recebem ids diferentes', async () => {
  const { db, store } = await setup()
  await store.getState().update(db, { fontSize: 22 })
  await store.getState().select(db, 'preset-claro')
  await store.getState().update(db, { fontSize: 24 })
  await store.getState().select(db, 'preset-claro')
  await store.getState().update(db, { fontSize: 26 })
  expect(
    store
      .getState()
      .themes.filter((t) => !t.builtin)
      .map((t) => t.id),
  ).toEqual(['custom-ya', 'custom-ya-2', 'custom-ya-3'])
})

test('apagar o tema ativo volta para o padrão', async () => {
  const { db, store } = await setup()
  await store.getState().update(db, { fontSize: 22 })
  await store.getState().remove(db, store.getState().active.id)
  expect(store.getState().active.id).toBe('preset-claro')
  expect(store.getState().themes).toHaveLength(PRESET_THEMES.length)
})

test('recarrega o tema ativo salvo', async () => {
  const { db, store } = await setup()
  await store.getState().select(db, 'preset-menta')
  const again = createThemeStore(() => 1)
  await again.getState().load(db)
  expect(again.getState().active.id).toBe('preset-menta')
})

test('adjust respeita passo e limites', () => {
  expect(adjust(18, 1, LIMITS.fontSize)).toBe(19)
  expect(adjust(32, 1, LIMITS.fontSize)).toBe(32)
  expect(adjust(1.6, 1, LIMITS.lineHeight)).toBe(1.7)
  expect(adjust(1.2, -1, LIMITS.lineHeight)).toBe(1.2)
  expect(adjust(24, -1, LIMITS.margin)).toBe(20)
})

test('tela acesa começa desligada, grava e recarrega', async () => {
  const { db, store } = await setup()
  expect(store.getState().keepAwake).toBe(false)
  await store.getState().setKeepAwake(db, true)
  expect(store.getState().keepAwake).toBe(true)
  const again = createThemeStore(() => 1)
  await again.getState().load(db)
  expect(again.getState().keepAwake).toBe(true)
})

test('temperatura começa em 0, grava e recarrega', async () => {
  const { db, store } = await setup()
  expect(store.getState().warmth).toBe(0)
  await store.getState().setWarmth(db, 40)
  const again = createThemeStore(() => 1)
  await again.getState().load(db)
  expect(again.getState().warmth).toBe(40)
})

test('brilho começa no do sistema e lembra o escolhido', async () => {
  const { db, store } = await setup()
  expect(store.getState().brightness).toBeNull()
  await store.getState().setBrightness(db, 30)
  expect(store.getState().brightness).toBe(30)
  expect(await getSetting(db, 'brightness')).toBe('30')
  await store.getState().setBrightness(db, null)
  expect(await getSetting(db, 'brightness')).toBe('system')
  const again = createThemeStore(() => 1)
  await again.getState().load(db)
  expect(again.getState().brightness).toBeNull()
})

test('sincronizar durante a leitura começa ligado', async () => {
  const { db, store } = await setup()
  expect(store.getState().syncWhileReading).toBe(true)
  await store.getState().setSyncWhileReading(db, false)
  const again = createThemeStore(() => 1)
  await again.getState().load(db)
  expect(again.getState().syncWhileReading).toBe(false)
})

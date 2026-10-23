import { migrate } from './migrations'
import { PRESET_THEMES } from './presets'
import { deleteTheme, getTheme, listThemes, saveTheme, toReaderTheme } from './themes'
import { openTestDb } from './testing/node-db'

async function setup() {
  const db = openTestDb()
  await migrate(db)
  return db
}

const custom = { ...PRESET_THEMES[0], id: 'custom-1', name: 'Meu', builtin: false }

test('lista os prontos com builtin como booleano', async () => {
  const db = await setup()
  const themes = await listThemes(db)
  expect(themes[0]).toEqual(PRESET_THEMES[0])
  expect(themes).toHaveLength(PRESET_THEMES.length)
})

test('cria, edita e apaga um tema próprio', async () => {
  const db = await setup()
  await saveTheme(db, custom)
  await saveTheme(db, { ...custom, fontSize: 22 })
  expect((await getTheme(db, 'custom-1'))?.fontSize).toBe(22)
  await deleteTheme(db, 'custom-1')
  expect(await getTheme(db, 'custom-1')).toBeNull()
})

test('recusa editar ou apagar um tema pronto', async () => {
  const db = await setup()
  await expect(saveTheme(db, { ...PRESET_THEMES[0], fontSize: 30 })).rejects.toThrow('Tema pronto')
  await expect(saveTheme(db, { ...PRESET_THEMES[0], builtin: false })).rejects.toThrow('Tema pronto')
  await expect(deleteTheme(db, PRESET_THEMES[0].id)).rejects.toThrow('Tema pronto')
})

test('editar um tema próprio não muda a ordem da lista', async () => {
  const db = await setup()
  await saveTheme(db, custom)
  await saveTheme(db, { ...custom, id: 'custom-2', name: 'Outro' })
  await saveTheme(db, { ...custom, fontSize: 22 })
  const ids = (await listThemes(db)).filter((t) => !t.builtin).map((t) => t.id)
  expect(ids).toEqual(['custom-1', 'custom-2'])
})

test('toReaderTheme tira id, nome e builtin', () => {
  const { id, name, builtin, ...rest } = PRESET_THEMES[0]
  expect([id, name, builtin]).toEqual(['preset-claro', 'Claro', true])
  expect(toReaderTheme(PRESET_THEMES[0])).toEqual(rest)
})

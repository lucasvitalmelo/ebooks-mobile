import type { ReaderTheme } from '@/reader/theme'
import type { FontId } from '@/reader/fonts'
import type { Db } from './db'
import { PRESET_THEMES } from './presets'

export interface Theme extends ReaderTheme {
  id: string
  name: string
  builtin: boolean
}

type ThemeRow = Omit<Theme, 'builtin' | 'fontFamily'> & { builtin: number; fontFamily: string }

function fromRow(row: ThemeRow): Theme {
  return { ...row, fontFamily: row.fontFamily as FontId, builtin: row.builtin === 1 }
}

export async function listThemes(db: Db): Promise<Theme[]> {
  const rows = await db.getAll<ThemeRow>('SELECT * FROM themes ORDER BY builtin DESC, rowid')
  // Os prontos na ordem de PRESET_THEMES: um pronto novo (o Preto, na migração 3)
  // entra no banco depois dos outros, mas tem lugar certo na lista.
  const presetIndex = (row: ThemeRow) => {
    const index = PRESET_THEMES.findIndex((preset) => preset.id === row.id)
    return row.builtin && index >= 0 ? index : PRESET_THEMES.length
  }
  return rows
    .map((row, rowOrder) => ({ row, rowOrder }))
    .sort((a, b) => presetIndex(a.row) - presetIndex(b.row) || a.rowOrder - b.rowOrder)
    .map(({ row }) => fromRow(row))
}

export async function getTheme(db: Db, id: string): Promise<Theme | null> {
  const row = await db.getFirst<ThemeRow>('SELECT * FROM themes WHERE id = ?', [id])
  return row && fromRow(row)
}

async function assertCustom(db: Db, id: string): Promise<void> {
  const existing = await getTheme(db, id)
  if (existing?.builtin) throw new Error('Tema pronto não pode ser alterado')
}

export async function saveTheme(db: Db, theme: Theme): Promise<void> {
  await assertCustom(db, theme.id)
  if (theme.builtin) throw new Error('Tema pronto não pode ser alterado')
  await db.run(
    `INSERT INTO themes (id, name, background, text, link, fontFamily, fontSize, lineHeight, margin, builtin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, background = excluded.background, text = excluded.text,
       link = excluded.link, fontFamily = excluded.fontFamily, fontSize = excluded.fontSize,
       lineHeight = excluded.lineHeight, margin = excluded.margin`,
    [
      theme.id,
      theme.name,
      theme.background,
      theme.text,
      theme.link,
      theme.fontFamily,
      theme.fontSize,
      theme.lineHeight,
      theme.margin,
    ],
  )
}

export async function deleteTheme(db: Db, id: string): Promise<void> {
  await assertCustom(db, id)
  await db.run('DELETE FROM themes WHERE id = ?', [id])
}

export function toReaderTheme({
  background,
  text,
  link,
  fontFamily,
  fontSize,
  lineHeight,
  margin,
}: Theme): ReaderTheme {
  return { background, text, link, fontFamily, fontSize, lineHeight, margin }
}

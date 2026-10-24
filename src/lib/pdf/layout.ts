// Texto do PDF → parágrafos e capítulos. PDF é página de posição fixa; o EPUB
// precisa de texto corrido, então a estrutura é reconstruída pelas posições.
export interface Line {
  text: string
  top: number
  height: number
}

export interface PageText {
  lines: Line[]
}

export interface OutlineEntry {
  title: string
  pageIndex: number
}

export interface Chapter {
  title: string
  paragraphs: string[]
}

const PARAGRAPH_GAP = 1.4
const PAGES_PER_PART = 20
const RUNNING_SHARE = 0.3
const RUNNING_MIN = 3
const PAGE_NUMBER = /^(p(á|a)g(ina)?\.?\s*)?#(\s*(de|\/)\s*#)?$/

const keyOf = (text: string) => text.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase()

export function dropRunningLines(pages: PageText[]): PageText[] {
  const counts = new Map<string, number>()
  for (const page of pages) {
    const edges = new Set([page.lines[0], page.lines[page.lines.length - 1]].filter(Boolean).map((l) => keyOf(l.text)))
    for (const key of edges) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const threshold = Math.max(RUNNING_MIN, pages.length * RUNNING_SHARE)
  return pages.map((page) => ({
    lines: page.lines.filter((line, index) => {
      const key = keyOf(line.text)
      if (PAGE_NUMBER.test(key)) return false
      const edge = index === 0 || index === page.lines.length - 1
      return !(edge && (counts.get(key) ?? 0) >= threshold)
    }),
  }))
}

function lineGaps(lines: Line[]): number[] {
  return lines
    .slice(1)
    .map((line, i) => line.top - lines[i].top)
    .filter((gap) => gap > 0)
}

// Espaçamento típico das linhas: a moda dos espaços arredondados (empate: o menor).
function typicalSpacing(gaps: number[]): number {
  const counts = new Map<number, number>()
  for (const gap of gaps) {
    const key = Math.round(gap)
    if (key > 0) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best = 0
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount || (count === bestCount && key < best)) {
      best = key
      bestCount = count
    }
  }
  return best
}

function join(current: string, next: string): string {
  if (current.endsWith('-') && /^[a-zà-ÿ]/.test(next)) return current.slice(0, -1) + next
  return `${current} ${next}`
}

export function paragraphs(lines: Line[], spacing: number = typicalSpacing(lineGaps(lines))): string[] {
  const out: string[] = []
  let current = ''
  lines.forEach((line, i) => {
    const text = line.text.replace(/\s+/g, ' ').trim()
    if (!text) return
    const gap = i > 0 ? line.top - lines[i - 1].top : 0
    if (current && spacing > 0 && gap > spacing * PARAGRAPH_GAP) {
      out.push(current)
      current = ''
    }
    current = current ? join(current, text) : text
  })
  if (current) out.push(current)
  return out
}

const ENDS_SENTENCE = /[.!?:;"”»)\]]$/

function pagesToParagraphs(pages: PageText[]): string[] {
  const spacing = typicalSpacing(pages.flatMap((page) => lineGaps(page.lines)))
  const out: string[] = []
  for (const page of pages) {
    const paras = paragraphs(page.lines, spacing)
    if (!paras.length) continue
    const last = out[out.length - 1]
    if (last && !ENDS_SENTENCE.test(last)) {
      out[out.length - 1] = join(last, paras[0])
      out.push(...paras.slice(1))
    } else out.push(...paras)
  }
  return out
}

export function chapters(pages: PageText[], outline: OutlineEntry[]): Chapter[] {
  const starts: OutlineEntry[] = []
  for (const entry of [...outline].sort((a, b) => a.pageIndex - b.pageIndex)) {
    if (entry.pageIndex < 0 || entry.pageIndex >= pages.length) continue
    if (starts.some((s) => s.pageIndex === entry.pageIndex)) continue
    starts.push({ title: entry.title.trim() || `Página ${entry.pageIndex + 1}`, pageIndex: entry.pageIndex })
  }
  const ranges: { title: string; from: number; to: number }[] = []
  if (starts.length) {
    if (starts[0].pageIndex > 0) ranges.push({ title: 'Início', from: 0, to: starts[0].pageIndex })
    starts.forEach((start, i) =>
      ranges.push({ title: start.title, from: start.pageIndex, to: starts[i + 1]?.pageIndex ?? pages.length }),
    )
  } else {
    for (let from = 0; from < pages.length; from += PAGES_PER_PART) {
      const to = Math.min(pages.length, from + PAGES_PER_PART)
      ranges.push({ title: `Páginas ${from + 1}–${to}`, from, to })
    }
  }
  return ranges
    .map((range) => ({ title: range.title, paragraphs: pagesToParagraphs(pages.slice(range.from, range.to)) }))
    .filter((chapter) => chapter.paragraphs.length > 0)
}

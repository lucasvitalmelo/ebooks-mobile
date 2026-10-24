export interface SearchResult {
  cfi: string
  excerpt: string
  chapterLabel: string | null
}

export function splitMatch(excerpt: string, query: string): { before: string; match: string; after: string } {
  const at = query ? excerpt.toLocaleLowerCase('pt-BR').indexOf(query.toLocaleLowerCase('pt-BR')) : -1
  if (at < 0) return { before: excerpt, match: '', after: '' }
  return {
    before: excerpt.slice(0, at),
    match: excerpt.slice(at, at + query.length),
    after: excerpt.slice(at + query.length),
  }
}

export function groupByChapter(results: SearchResult[]): { chapterLabel: string | null; results: SearchResult[] }[] {
  const groups: { chapterLabel: string | null; results: SearchResult[] }[] = []
  for (const result of results) {
    const last = groups[groups.length - 1]
    if (last && last.chapterLabel === result.chapterLabel) last.results.push(result)
    else groups.push({ chapterLabel: result.chapterLabel, results: [result] })
  }
  return groups
}

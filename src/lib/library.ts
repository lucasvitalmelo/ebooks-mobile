interface Candidate {
  lastOpenedAt: number | null
  percent: number | null
}

// A lista já vem com os abertos por último primeiro.
export function pickContinue<T extends Candidate>(books: T[]): T | null {
  const opened = books.filter((b) => b.lastOpenedAt !== null)
  return opened.find((b) => b.percent !== null && b.percent > 0 && b.percent < 1) ?? opened[0] ?? null
}

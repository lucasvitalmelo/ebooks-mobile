import type { DriveStatus } from '@/store/drive-store'

// Desconectado do Drive não há como baixar os livros que só estão lá: eles saem
// da biblioteca, mas os registros (progresso, grifos) ficam e voltam ao conectar.
// Sem internet ou com o login a refazer, continuam: a conexão volta sozinha.
export function libraryBooks<T extends { blobUpdatedAt: number | null }>(books: T[], status: DriveStatus): T[] {
  return status === 'desconectado' ? books.filter((book) => book.blobUpdatedAt !== null) : books
}

interface Candidate {
  lastOpenedAt: number | null
  percent: number | null
}

// A lista já vem com os abertos por último primeiro.
export function pickContinue<T extends Candidate>(books: T[]): T | null {
  const opened = books.filter((b) => b.lastOpenedAt !== null)
  return opened.find((b) => b.percent !== null && b.percent > 0 && b.percent < 1) ?? opened[0] ?? null
}

// Durante a leitura, a posição sobe uma pausa depois da última gravação (páginas
// viradas em sequência viram uma sincronização só) e nunca antes de passar o
// intervalo desde a última sincronização: sem isso, cada página lida rodaria uma
// sincronização inteira.
export const READING_SYNC_DEBOUNCE_MS = 15_000
export const READING_SYNC_GAP_MS = 180_000

export function delayForReadingSync(
  now: number,
  lastSyncAt: number | null,
  debounce = READING_SYNC_DEBOUNCE_MS,
  gap = READING_SYNC_GAP_MS,
): number {
  if (lastSyncAt === null) return debounce
  return Math.max(debounce, lastSyncAt + gap - now)
}

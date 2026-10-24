import { createStore } from 'zustand/vanilla'
import type { Db } from '@/lib/db/db'
import { SyncError, type SyncProblem, type SyncSummary, type UploadProgress } from '@/lib/sync/run'

export type SyncStatus = 'parado' | 'sincronizando' | 'erro'

// How a run() that actually synced went.
export interface SyncOutcome {
  error: string | null
  // Whether books from another device were announced.
  announced: boolean
}

export interface SyncState {
  status: SyncStatus
  // This session's last successful sync.
  lastSyncAt: number | null
  error: string | null
  // Why the last sync failed: what the run reported, or books Drive refused.
  problem: SyncProblem | 'recusados' | null
  // The books going up in the sync running now; null when there are none.
  progress: UploadProgress | null
  // The error the strip was closed on. It comes back with a different
  // message, or with an error after a sync that worked.
  dismissedError: string | null
  // Goes up when a sync changed what's on this device (records from the other
  // side, covers, or the Drive ids of books that went up), so the library reloads.
  revision: number
  // A call while a sync runs asks for one more right after it.
  again: boolean
  // null when it didn't sync: the Drive isn't connected, or a sync was running.
  run: (db: Db) => Promise<SyncOutcome | null>
  dismissError: () => void
}

export interface SyncStoreDeps {
  isConnected(): boolean
  sync(db: Db, onApplied: () => void, onProgress: (progress: UploadProgress) => void): Promise<SyncSummary>
  onAccountProblem(): void
  notify(text: string): void
  now(): number
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace('#', String(count))
}

export function createSyncStore(deps: SyncStoreDeps) {
  // Only books are announced: progress and highlights from another device come
  // in on every return from the reader, and a toast each time would be noise.
  function announceBooks(added: number, removed: number): boolean {
    if (added > 0) {
      deps.notify(plural(added, '1 livro chegou de outro aparelho', '# livros chegaram de outro aparelho'))
    }
    if (removed > 0) {
      deps.notify(
        plural(removed, '1 livro foi removido em outro aparelho', '# livros foram removidos em outro aparelho'),
      )
    }
    return added > 0 || removed > 0
  }

  return createStore<SyncState>((set, get) => ({
    status: 'parado',
    lastSyncAt: null,
    error: null,
    problem: null,
    progress: null,
    dismissedError: null,
    revision: 0,
    again: false,
    // Does nothing unless the Drive is connected. Called while a sync runs, it
    // runs another one right after, so a change made meanwhile (an import, an
    // edit) isn't left for the next visit to the library.
    run: async (db) => {
      if (!deps.isConnected()) return null
      if (get().status === 'sincronizando') {
        set({ again: true })
        return null
      }
      set({ status: 'sincronizando', error: null, problem: null, progress: null, again: false })
      let outcome: SyncOutcome
      try {
        // The other devices' books show up as soon as they're in, not after this
        // device's uploads.
        const summary = await deps.sync(
          db,
          () => set((state) => ({ revision: state.revision + 1 })),
          (progress) => set({ progress }),
        )
        const changed = summary.applied > 0 || summary.covers > 0 || summary.uploaded > 0
        // Books Drive refused stay pending; the strip says so instead of "em dia".
        const refused = summary.skipped > 0
        const error = refused
          ? plural(
              summary.skipped,
              '1 livro não subiu para o Google Drive.',
              '# livros não subiram para o Google Drive.',
            )
          : null
        set((state) => ({
          status: refused ? 'erro' : 'parado',
          lastSyncAt: deps.now(),
          error,
          problem: refused ? 'recusados' : null,
          progress: null,
          dismissedError: refused ? state.dismissedError : null,
          revision: changed ? state.revision + 1 : state.revision,
        }))
        outcome = { error, announced: announceBooks(summary.booksAdded, summary.booksRemoved) }
      } catch (error) {
        const problem = error instanceof SyncError ? error : null
        const message = problem?.message ?? 'Não foi possível sincronizar.'
        // What came in before the failure is already here: the library reads again.
        set((state) => ({
          status: 'erro',
          error: message,
          problem: problem?.problem ?? 'erro',
          progress: null,
          revision: state.revision + 1,
        }))
        // The login itself went wrong: the Drive button should say so.
        if (problem?.problem === 'conta') deps.onAccountProblem()
        // Books that arrived before the failure are in the library already.
        outcome = { error: message, announced: announceBooks(problem?.booksAdded ?? 0, problem?.booksRemoved ?? 0) }
      }
      if (get().again) void get().run(db)
      return outcome
    },
    dismissError: () => set((state) => ({ dismissedError: state.error })),
  }))
}

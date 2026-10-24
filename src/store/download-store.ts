import { createStore } from 'zustand/vanilla'
import type { Book } from '@/lib/db/books'
import type { Db } from '@/lib/db/db'
import { DriveAuthError } from '@/lib/drive/auth-error'

export interface DownloadState {
  downloading: string[]
  // Sobe quando um download terminou, para a biblioteca recarregar.
  revision: number
  // Baixa, ou espera o download do mesmo livro que já está em andamento (o
  // botão do cartão e o leitor nunca gravam o mesmo arquivo ao mesmo tempo).
  // Lança a falha para quem chamou.
  ensure(db: Db, book: Book): Promise<void>
  // O do botão: a falha vira um aviso.
  download(db: Db, book: Book): Promise<void>
}

function reason(error: unknown): string {
  if (error instanceof DriveAuthError) {
    return error.problem === 'indisponivel' ? 'Sem conexão com a internet.' : 'Conecte o Google Drive para baixar.'
  }
  if (error instanceof TypeError || /network/i.test(String(error))) return 'Sem conexão com a internet.'
  return error instanceof Error ? error.message : String(error)
}

// Fora da tela da biblioteca, para o download continuar com um livro aberto.
export function createDownloadStore(deps: { download(db: Db, book: Book): Promise<void>; notify(text: string): void }) {
  const running = new Map<string, Promise<void>>()
  return createStore<DownloadState>((set, get) => ({
    downloading: [],
    revision: 0,
    ensure: (db, book) => {
      const current = running.get(book.id)
      if (current) return current
      set((state) => ({ downloading: [...state.downloading, book.id] }))
      const done = deps
        .download(db, book)
        .then(() => set((state) => ({ revision: state.revision + 1 })))
        .finally(() => {
          running.delete(book.id)
          set((state) => ({ downloading: state.downloading.filter((id) => id !== book.id) }))
        })
      running.set(book.id, done)
      return done
    },
    download: async (db, book) => {
      try {
        await get().ensure(db, book)
      } catch (error) {
        deps.notify(`Não foi possível baixar "${book.title}". ${reason(error)}`)
      }
    },
  }))
}

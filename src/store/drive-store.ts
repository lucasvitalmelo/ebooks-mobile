import { createStore } from 'zustand/vanilla'
import type { Db } from '@/lib/db/db'
import { setDriveEnabled } from '@/lib/db/deletions'
import { DriveAuthError } from '@/lib/drive/auth-error'

export type DriveStatus = 'verificando' | 'indisponivel' | 'desconectado' | 'conectado' | 'reconectar'

export interface DriveAccount {
  email: string
  name: string | null
}

export interface DriveAuth {
  getAccessToken(): Promise<string>
  currentAccount(): DriveAccount | null
  connect(): Promise<DriveAccount | null>
  disconnect(): Promise<void>
  // Esquece o token guardado (o que um check atrasado trouxe depois de desconectar).
  invalidateToken(): void
}

export interface DriveState {
  status: DriveStatus
  account: DriveAccount | null
  check(db: Db): Promise<void>
  // false: a pessoa fechou a tela de login.
  connect(db: Db): Promise<boolean>
  disconnect(db: Db): Promise<void>
}

export function createDriveStore(auth: DriveAuth) {
  // Sobe a cada desconexão: um check que começou antes e responde depois não
  // pode trazer a conexão de volta.
  let generation = 0
  return createStore<DriveState>((set) => ({
    status: 'verificando',
    account: null,
    check: async (db) => {
      const started = generation
      try {
        // Antes da conta: é o token que faz o login silencioso.
        await auth.getAccessToken()
      } catch (error) {
        if (started !== generation) return
        set({ status: error instanceof DriveAuthError ? error.problem : 'indisponivel', account: null })
        return
      }
      // O token que chegou depois de uma desconexão não pode ficar guardado.
      const stale = () => {
        if (started === generation) return false
        auth.invalidateToken()
        return true
      }
      if (stale()) return
      // Só uma desconexão explícita desliga: exclusões feitas com o login
      // momentaneamente fora ainda precisam chegar aos outros aparelhos.
      await setDriveEnabled(db, true)
      if (stale()) return
      set({ status: 'conectado', account: auth.currentAccount() })
    },
    connect: async (db) => {
      const account = await auth.connect()
      if (!account) return false
      generation++
      await setDriveEnabled(db, true)
      set({ status: 'conectado', account })
      return true
    },
    disconnect: async (db) => {
      generation++
      await auth.disconnect()
      await setDriveEnabled(db, false)
      set({ status: 'desconectado', account: null })
    },
  }))
}

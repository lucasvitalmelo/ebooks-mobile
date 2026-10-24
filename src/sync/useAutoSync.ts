import { useEffect } from 'react'
import { AppState } from 'react-native'
import type { Db } from '@/lib/db/db'
import { driveStore, syncStore } from '@/store/sync'

export const AUTO_SYNC_INTERVAL = 5 * 60 * 1000
// Voltar ao app logo depois de uma sincronização não dispara outra.
const MIN_GAP = 30 * 1000

let last = 0
let busy = false

// O intervalo só conta a partir de uma sincronização que rodou de verdade: com
// o Drive ainda sendo verificado, ou sem sincronizar (desconectado, uma já em
// andamento), o próximo gatilho tenta de novo.
async function runIfDue(db: Db) {
  if (busy || Date.now() - last < MIN_GAP) return
  const status = driveStore.getState().status
  if (status === 'verificando') return
  busy = true
  try {
    // Aberto sem internet, o Drive ficou indisponível: verifica de novo antes,
    // senão a sessão inteira ficaria sem sincronizar.
    if (status === 'indisponivel' || status === 'reconectar') await driveStore.getState().check(db)
    // Uma em andamento (a de sair de um livro) já serve: pedir outra a repetiria logo depois.
    if (syncStore.getState().status === 'sincronizando') return
    if (await syncStore.getState().run(db)) last = Date.now()
  } finally {
    busy = false
  }
}

// Ao abrir o app (depois de ver se o Drive está conectado), ao voltar para a
// frente e a cada 5 minutos com o app aberto. Em segundo plano não roda.
export function useAutoSync(db: Db) {
  useEffect(() => {
    void driveStore
      .getState()
      .check(db)
      .then(() => runIfDue(db))
      .catch((error: unknown) => console.warn('Não foi possível sincronizar', error))
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active')
        void runIfDue(db).catch((error: unknown) => console.warn('Não foi possível sincronizar', error))
    })
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') {
        void runIfDue(db).catch((error: unknown) => console.warn('Não foi possível sincronizar', error))
      }
    }, AUTO_SYNC_INTERVAL)
    return () => {
      subscription.remove()
      clearInterval(timer)
    }
  }, [db])
}

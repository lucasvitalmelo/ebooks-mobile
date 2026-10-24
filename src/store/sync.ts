import { useStore } from 'zustand'
import type { Db } from '@/lib/db/db'
import { connectDrive, currentAccount, disconnectDrive, getAccessToken, invalidateAccessToken } from '@/lib/drive/auth'
import { driveApi } from '@/lib/drive/client'
import { deleteFiles, readFileBytes, replaceBytes, writeBytes } from '@/lib/files'
import { withLibraryLock } from '@/lib/library-lock'
import { notify } from '@/lib/notify'
import { downloadBook, type BookFileDeps } from '@/lib/sync/book-file'
import { syncNow } from '@/lib/sync/run'
import { createDownloadStore, type DownloadState } from './download-store'
import { createDriveStore, type DriveState } from './drive-store'
import { createSyncStore, type SyncState } from './sync-store'

export const driveStore = createDriveStore({
  getAccessToken,
  currentAccount,
  connect: connectDrive,
  disconnect: disconnectDrive,
  invalidateToken: invalidateAccessToken,
})

// O banco da última sincronização, para verificar o login quando ela falha por causa da conta.
let lastDb: Db | null = null

export const syncStore = createSyncStore({
  isConnected: () => driveStore.getState().status === 'conectado',
  sync: (db, onApplied, onProgress) => {
    lastDb = db
    return syncNow(
      {
        db,
        api: driveApi,
        readFile: readFileBytes,
        writeFile: writeBytes,
        deleteFiles,
        lock: withLibraryLock,
        log: (event, detail) => console.log(`[sync] ${event}${detail ? `: ${detail}` : ''}`),
      },
      onApplied,
      onProgress,
    )
  },
  onAccountProblem: () => {
    if (lastDb) void driveStore.getState().check(lastDb)
  },
  notify,
  now: Date.now,
})

export function bookFileDeps(db: Db): BookFileDeps {
  return { db, api: driveApi, replaceFile: replaceBytes, lock: withLibraryLock }
}

export const downloadStore = createDownloadStore({
  download: (db, book) => downloadBook(bookFileDeps(db), book),
  notify,
})

export const useDriveStore = <T>(selector: (state: DriveState) => T) => useStore(driveStore, selector)
export const useSyncStore = <T>(selector: (state: SyncState) => T) => useStore(syncStore, selector)
export const useDownloadStore = <T>(selector: (state: DownloadState) => T) => useStore(downloadStore, selector)

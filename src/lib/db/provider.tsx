import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite'
import { useMemo, type ReactNode } from 'react'
import type { Db } from './db'
import { fromExpo } from './expo-db'
import { migrate } from './migrations'

function init(db: SQLiteDatabase) {
  return migrate(fromExpo(db))
}

export function DbProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName="ebooks.db" onInit={init}>
      {children}
    </SQLiteProvider>
  )
}

export function useDb(): Db {
  const sqlite = useSQLiteContext()
  return useMemo(() => fromExpo(sqlite), [sqlite])
}

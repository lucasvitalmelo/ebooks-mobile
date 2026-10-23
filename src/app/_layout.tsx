import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, type ReactNode } from 'react'
import { DbProvider, useDb } from '@/lib/db/provider'
import { themeStore } from '@/store/theme-store'

function ThemeLoader({ children }: { children: ReactNode }) {
  const db = useDb()
  useEffect(() => {
    themeStore
      .getState()
      .load(db)
      .catch((error: unknown) => console.error('Não foi possível carregar o tema.', error))
  }, [db])
  return children
}

export default function RootLayout() {
  return (
    <DbProvider>
      <ThemeLoader>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="auto" />
      </ThemeLoader>
    </DbProvider>
  )
}

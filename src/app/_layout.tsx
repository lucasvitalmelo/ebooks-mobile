import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, type ReactNode } from 'react'
import { DbProvider, useDb } from '@/lib/db/provider'
import { chromeFor } from '@/lib/tone'
import { themeStore, useThemeStore } from '@/store/theme-store'

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

function ThemedStack() {
  const background = useThemeStore((s) => s.active.background)
  return (
    <>
      {/* "auto" seguia o modo escuro do celular, e as telas seguem o tema: ícones brancos no fundo branco (#25). */}
      <StatusBar style={chromeFor(background).statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }} />
    </>
  )
}

export default function RootLayout() {
  return (
    <DbProvider>
      <ThemeLoader>
        <ThemedStack />
      </ThemeLoader>
    </DbProvider>
  )
}

import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, useFonts } from '@expo-google-fonts/geist'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, type ReactNode } from 'react'
import { WarmthOverlay } from '@/components/WarmthOverlay'
import { DbProvider, useDb } from '@/lib/db/provider'
import { paletteFor } from '@/lib/palette'
import { themeStore, useThemeStore } from '@/store/theme-store'
import { useAutoSync } from '@/sync/useAutoSync'

function ThemeLoader({ children }: { children: ReactNode }) {
  const db = useDb()
  useEffect(() => {
    themeStore
      .getState()
      .load(db)
      .catch((error: unknown) => console.error('Não foi possível carregar o tema.', error))
  }, [db])
  useAutoSync(db)
  return children
}

function ThemedStack() {
  const active = useThemeStore((s) => s.active)
  const palette = paletteFor(active)
  return (
    <>
      {/* "auto" seguia o modo escuro do celular, e as telas seguem o tema (#25). */}
      <StatusBar style={palette.statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }} />
      <WarmthOverlay />
    </>
  )
}

export default function RootLayout() {
  const [loaded, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold })
  useEffect(() => {
    if (fontError) console.error('Não foi possível carregar a Geist.', fontError)
  }, [fontError])
  // A interface inteira usa a Geist; sem ela os textos piscariam com a fonte do sistema.
  // Se ela falhar, segue com a do sistema em vez de ficar com a tela vazia.
  if (!loaded && !fontError) return null
  return (
    <DbProvider>
      <ThemeLoader>
        <ThemedStack />
      </ThemeLoader>
    </DbProvider>
  )
}

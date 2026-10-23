import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { DbProvider } from '@/lib/db/provider'

export default function RootLayout() {
  return (
    <DbProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </DbProvider>
  )
}

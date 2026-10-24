import { Cloud, CloudAlert, CloudCheck, CloudOff, RefreshCw } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native'
import type { Palette } from '@/lib/palette'
import { useDriveStore, useSyncStore } from '@/store/sync'

interface Props {
  palette: Palette
  onPress(): void
}

export function SyncButton({ palette, onPress }: Props) {
  const drive = useDriveStore((s) => s.status)
  const sync = useSyncStore((s) => s.status)
  const [spin] = useState(() => new Animated.Value(0))
  const syncing = drive === 'conectado' && sync === 'sincronizando'

  useEffect(() => {
    if (!syncing) return
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    )
    loop.start()
    return () => {
      loop.stop()
      spin.setValue(0)
    }
  }, [syncing, spin])

  // Guarda o lugar: a engrenagem (e as setas da biblioteca vazia) não pulam quando ele aparece.
  if (drive === 'verificando') return <View style={styles.button} />

  const color = palette.text
  const icon = syncing ? (
    <Animated.View
      style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
    >
      <RefreshCw size={20} color={color} />
    </Animated.View>
  ) : drive === 'desconectado' || drive === 'indisponivel' ? (
    <CloudOff size={20} color={palette.muted} />
  ) : drive === 'reconectar' || sync === 'erro' ? (
    <CloudAlert size={20} color={color} />
  ) : sync === 'parado' ? (
    <CloudCheck size={20} color={color} />
  ) : (
    <Cloud size={20} color={color} />
  )
  return (
    <Pressable accessibilityLabel="Google Drive" onPress={onPress} style={styles.button}>
      {icon}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})

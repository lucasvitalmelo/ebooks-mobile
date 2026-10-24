import { X } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native'
import { ProgressBar } from '@/components/ProgressBar'
import { useDb } from '@/lib/db/provider'
import type { Palette } from '@/lib/palette'
import { syncStripState } from '@/store/sync-strip'
import { driveStore, syncStore, useDriveStore, useSyncStore } from '@/store/sync'
import { UI_FONT } from '@/ui/fonts'

export function SyncStrip({ palette }: { palette: Palette }) {
  const db = useDb()
  const driveStatus = useDriveStore((s) => s.status)
  const sync = useSyncStore((s) => s)
  const strip = syncStripState(sync, driveStatus)
  if (!strip) return null
  if (strip.kind === 'progresso') {
    return (
      <View style={[styles.strip, { backgroundColor: palette.panel }]}>
        <Text style={[styles.text, { color: palette.text }]}>
          Enviando livros para o Google Drive ({strip.done} de {strip.total})
        </Text>
        <ProgressBar value={strip.done / strip.total} palette={palette} width="100%" />
      </View>
    )
  }
  const act = () => {
    if (strip.action === 'tentar') {
      void syncStore.getState().run(db)
      return
    }
    driveStore
      .getState()
      .connect(db)
      .then((ok) => (ok ? syncStore.getState().run(db) : null))
      .catch((error: unknown) => {
        console.error(error)
        ToastAndroid.show('Não foi possível conectar ao Google Drive.', ToastAndroid.LONG)
      })
  }
  return (
    <View style={[styles.strip, styles.row, { backgroundColor: palette.panel }]}>
      <Text style={[styles.text, styles.grow, { color: palette.text }]}>{strip.message}</Text>
      <Pressable onPress={act} style={styles.action}>
        <Text style={[styles.actionText, { color: palette.link }]}>
          {strip.action === 'reconectar' ? 'Conectar de novo' : 'Tentar de novo'}
        </Text>
      </Pressable>
      <Pressable accessibilityLabel="Fechar aviso" onPress={() => sync.dismissError()} style={styles.close}>
        <X size={16} color={palette.muted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  strip: { marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingRight: 0 },
  grow: { flex: 1, paddingVertical: 12 },
  text: { fontSize: 13, fontFamily: UI_FONT.regular },
  action: { paddingHorizontal: 8, minHeight: 44, justifyContent: 'center' },
  actionText: { fontSize: 13, fontFamily: UI_FONT.medium },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})

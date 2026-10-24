import { Alert, Modal, Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WarmthOverlay } from '@/components/WarmthOverlay'
import { useDb } from '@/lib/db/provider'
import type { Palette } from '@/lib/palette'
import { driveStore, syncStore, useDriveStore, useSyncStore } from '@/store/sync'
import { UI_FONT } from '@/ui/fonts'

interface Props {
  visible: boolean
  palette: Palette
  onClose(): void
}

function time(at: number): string {
  return new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function DriveSheet({ visible, palette, onClose }: Props) {
  const db = useDb()
  const insets = useSafeAreaInsets()
  const status = useDriveStore((s) => s.status)
  const account = useDriveStore((s) => s.account)
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt)
  const syncing = useSyncStore((s) => s.status === 'sincronizando')

  async function connect() {
    try {
      if (await driveStore.getState().connect(db)) {
        onClose()
        void syncStore.getState().run(db)
      }
    } catch (error) {
      console.error(error)
      ToastAndroid.show('Não foi possível conectar ao Google Drive.', ToastAndroid.LONG)
    }
  }

  function disconnect() {
    Alert.alert(
      'Desconectar o Google Drive?',
      'Os livros continuam neste aparelho. Para voltar a sincronizar, conecte de novo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            try {
              await driveStore.getState().disconnect(db)
              onClose()
            } catch (error) {
              console.error(error)
              ToastAndroid.show('Não foi possível desconectar.', ToastAndroid.LONG)
            }
          },
        },
      ],
    )
  }

  const button = (label: string, onPress: () => void, primary = false, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        primary ? { backgroundColor: palette.primary } : { borderColor: palette.border, borderWidth: 1 },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? palette.onPrimary : palette.text }]}>{label}</Text>
    </Pressable>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: palette.panel, paddingBottom: 20 + insets.bottom }]}>
        <Text style={[styles.title, { color: palette.text }]}>Google Drive</Text>
        {status === 'conectado' ? (
          <>
            <Text style={[styles.text, { color: palette.muted }]}>
              {account?.email ?? 'Conectado'}
              {lastSyncAt ? ` · sincronizado às ${time(lastSyncAt)}` : ''}
            </Text>
            {button(
              syncing ? 'Sincronizando…' : 'Sincronizar agora',
              () => void syncStore.getState().run(db),
              true,
              syncing,
            )}
            {button('Desconectar', disconnect)}
          </>
        ) : status === 'indisponivel' ? (
          <>
            <Text style={[styles.text, { color: palette.muted }]}>
              Não foi possível falar com o Google agora (sem internet, ou o app aberto pelo Expo Go).
            </Text>
            {button('Tentar de novo', () => void driveStore.getState().check(db), true)}
          </>
        ) : (
          <>
            <Text style={[styles.text, { color: palette.muted }]}>
              {status === 'reconectar'
                ? 'O Google pediu para entrar de novo.'
                : 'Conecte para ter os mesmos livros, o progresso e os grifos aqui, no leitor web e nos seus outros aparelhos. O app só vê a pasta MyBooks que ele mesmo criou.'}
            </Text>
            {button(status === 'reconectar' ? 'Conectar de novo' : 'Conectar Google Drive', () => void connect(), true)}
          </>
        )}
        <WarmthOverlay />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, gap: 12, overflow: 'hidden' },
  title: { fontSize: 16, fontFamily: UI_FONT.semibold },
  text: { fontSize: 14, lineHeight: 20, fontFamily: UI_FONT.regular },
  button: { height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontFamily: UI_FONT.medium },
  disabled: { opacity: 0.5 },
})

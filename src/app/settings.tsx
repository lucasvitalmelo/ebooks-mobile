import Constants from 'expo-constants'
import { router, useFocusEffect } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useCallback, useState, type ReactNode } from 'react'
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, ToastAndroid, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LightControls } from '@/components/LightControls'
import { listBooks, removeLocalFile, type Book } from '@/lib/db/books'
import { useDb } from '@/lib/db/provider'
import { deleteFiles } from '@/lib/files'
import { withLibraryLock } from '@/lib/library-lock'
import { canFreeSpace, formatSize, spaceUsed } from '@/lib/library-space'
import { paletteFor } from '@/lib/palette'
import { driveStore, syncStore, useDriveStore, useSyncStore } from '@/store/sync'
import { themeStore, useThemeStore } from '@/store/theme-store'
import { UI_FONT } from '@/ui/fonts'

const PRIVACY_URL = 'https://mybook.inkttoo.com/privacy.html'
const REPO_URL = 'https://github.com/lucasvitalmelo/ebooks-mobile'
const DESTRUCTIVE = '#e7000b'

function report(error: unknown) {
  console.error('Não foi possível salvar a configuração.', error)
}

export default function Settings() {
  const db = useDb()
  const theme = useThemeStore((s) => s.active)
  const palette = paletteFor(theme)
  const keepAwake = useThemeStore((s) => s.keepAwake)
  const syncWhileReading = useThemeStore((s) => s.syncWhileReading)
  const driveStatus = useDriveStore((s) => s.status)
  const account = useDriveStore((s) => s.account)
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt)
  const syncing = useSyncStore((s) => s.status === 'sincronizando')
  const [books, setBooks] = useState<Book[]>([])
  const reload = useCallback(
    () =>
      listBooks(db)
        .then(setBooks)
        .catch((error: unknown) => console.error('Não foi possível ler a biblioteca.', error)),
    [db],
  )
  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )
  const connected = driveStatus === 'conectado'
  const used = spaceUsed(books)
  const freeable = books.filter(canFreeSpace)

  function freeSpace() {
    const bytes = freeable.reduce((sum, book) => sum + book.size, 0)
    const one = freeable.length === 1
    Alert.alert(
      'Liberar espaço?',
      `${freeable.length} ${one ? 'livro sai' : 'livros saem'} deste aparelho (${formatSize(bytes)}) e ${one ? 'continua' : 'continuam'} no Google Drive, com progresso e grifos. Dá para baixar de novo quando quiser.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar',
          onPress: async () => {
            // Um livro que falha não impede os outros.
            const failed = await withLibraryLock(async () => {
              let count = 0
              for (const book of freeable) {
                try {
                  await removeLocalFile(db, book.id)
                  deleteFiles([book.filePath])
                } catch (error) {
                  console.error(error)
                  count++
                }
              }
              return count
            })
            ToastAndroid.show(
              failed === 0
                ? 'Espaço liberado'
                : `${failed} ${failed === 1 ? 'livro não pôde ser liberado.' : 'livros não puderam ser liberados.'}`,
              failed === 0 ? ToastAndroid.SHORT : ToastAndroid.LONG,
            )
            await reload()
          },
        },
      ],
    )
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
          onPress: () => void driveStore.getState().disconnect(db).catch(report),
        },
      ],
    )
  }

  async function connect() {
    try {
      if (await driveStore.getState().connect(db)) void syncStore.getState().run(db)
    } catch (error) {
      console.error(error)
      ToastAndroid.show('Não foi possível conectar ao Google Drive.', ToastAndroid.LONG)
    }
  }

  const section = (title: string, children: ReactNode) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.muted }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: palette.panel }]}>{children}</View>
    </View>
  )
  const divider = <View style={[styles.divider, { backgroundColor: palette.border }]} />
  const toggle = (label: string, value: boolean, onChange: (value: boolean) => void) => (
    <View style={styles.row}>
      <Text style={[styles.text, styles.grow, { color: palette.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: palette.fill, false: palette.track }}
        thumbColor={palette.primary}
      />
    </View>
  )
  const action = (label: string, onPress: () => void, color = palette.text, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      style={[styles.row, disabled && styles.disabled]}
    >
      <Text style={[styles.text, { color }]}>{label}</Text>
    </Pressable>
  )
  const time = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.icon}>
          <ArrowLeft size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>Configurações</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {section(
          'Leitura',
          <>
            <View style={styles.padded}>
              <LightControls palette={palette} />
            </View>
            {divider}
            {toggle('Manter a tela ligada', keepAwake, (value) =>
              themeStore.getState().setKeepAwake(db, value).catch(report),
            )}
          </>,
        )}
        {section(
          'Google Drive',
          connected ? (
            <>
              <View style={styles.padded}>
                <Text style={[styles.text, { color: palette.text }]}>{account?.email ?? 'Conectado'}</Text>
                {lastSyncAt !== null && (
                  <Text style={[styles.hint, { color: palette.muted }]}>Sincronizado às {time(lastSyncAt)}</Text>
                )}
              </View>
              {divider}
              {toggle('Sincronizar durante a leitura', syncWhileReading, (value) =>
                themeStore.getState().setSyncWhileReading(db, value).catch(report),
              )}
              {divider}
              {action(
                syncing ? 'Sincronizando…' : 'Sincronizar agora',
                () => void syncStore.getState().run(db),
                palette.text,
                syncing,
              )}
              {divider}
              {action('Desconectar', disconnect, DESTRUCTIVE)}
            </>
          ) : (
            <>
              <View style={styles.padded}>
                <Text style={[styles.hint, { color: palette.muted }]}>
                  {driveStatus === 'indisponivel'
                    ? 'Não foi possível falar com o Google agora.'
                    : 'Conecte para ter os mesmos livros, o progresso e os grifos no leitor web e nos outros aparelhos.'}
                </Text>
              </View>
              {divider}
              {action(
                driveStatus === 'reconectar' ? 'Conectar de novo' : 'Conectar Google Drive',
                () => void connect(),
                palette.text,
                driveStatus === 'verificando',
              )}
            </>
          ),
        )}
        {section(
          'Biblioteca',
          <>
            <View style={styles.padded}>
              <Text style={[styles.text, { color: palette.text }]}>Espaço usado</Text>
              <Text style={[styles.hint, { color: palette.muted }]}>
                {formatSize(used.bytes)} em {used.books} {used.books === 1 ? 'livro baixado' : 'livros baixados'}
              </Text>
            </View>
            {divider}
            {action(
              'Liberar espaço dos livros que estão no Drive',
              freeSpace,
              palette.text,
              !connected || freeable.length === 0,
            )}
          </>,
        )}
        {section(
          'Sobre',
          <>
            <View style={styles.row}>
              <Text style={[styles.text, styles.grow, { color: palette.text }]}>Versão</Text>
              <Text style={[styles.text, { color: palette.muted }]}>{Constants.expoConfig?.version ?? '-'}</Text>
            </View>
            {divider}
            {action('Política de privacidade', () => void Linking.openURL(PRIVACY_URL))}
            {divider}
            {action('Código no GitHub', () => void Linking.openURL(REPO_URL))}
          </>,
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 8,
  },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: UI_FONT.semibold },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 20 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontFamily: UI_FONT.medium },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  padded: { paddingVertical: 12, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  grow: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  text: { fontSize: 15, fontFamily: UI_FONT.regular },
  hint: { fontSize: 12, fontFamily: UI_FONT.regular },
  disabled: { opacity: 0.5 },
})

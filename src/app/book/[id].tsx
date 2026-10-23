import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Linking, Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Reader, type ReaderHandle } from '@/components/Reader'
import { getBook, markOpened, saveLocations, type Book } from '@/lib/db/books'
import { PRESET_THEMES } from '@/lib/db/presets'
import { getProgress, saveProgress } from '@/lib/db/progress'
import { useDb } from '@/lib/db/provider'
import { toReaderTheme } from '@/lib/db/themes'
import { readBase64 } from '@/lib/files'
import type { ReaderEvent } from '@/reader/protocol'

const SAVE_DELAY_MS = 1000

function report(message: string) {
  return (error: unknown) => {
    console.error(message, error)
    ToastAndroid.show(message, ToastAndroid.LONG)
  }
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const db = useDb()
  const reader = useRef<ReaderHandle>(null)
  const theme = PRESET_THEMES[0]
  const [book, setBook] = useState<Book | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const [barVisible, setBarVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<{ cfi: string; percent: number | null } | null>(null)
  // A porcentagem só existe depois das locations; um relocated sem ela não
  // pode apagar a que já se sabia.
  const lastPercent = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const position = pending.current
    if (!position) return
    pending.current = null
    try {
      await saveProgress(db, { bookId: id, ...position }, Date.now())
    } catch (e) {
      // Volta para a fila, a não ser que uma posição mais nova já tenha chegado.
      pending.current ??= position
      throw e
    }
  }, [db, id])

  const save = useCallback(() => flush().catch(report('Não foi possível salvar a posição de leitura.')), [flush])

  // O sistema pode matar o app em segundo plano sem avisar: grava na hora.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void save()
    })
    return () => {
      subscription.remove()
      void save()
    }
  }, [save])

  // Também chega de novo quando a WebView é remontada (o Android matou o processo
  // dela): a posição pendente vai para o banco antes de reabrir a partir dele.
  const open = useCallback(async () => {
    try {
      await save()
      const found = await getBook(db, id)
      if (!found) return setError('Livro não encontrado.')
      setBook(found)
      const [progress, base64] = await Promise.all([getProgress(db, id), readBase64(found.filePath)])
      lastPercent.current = progress?.percent ?? null
      setPercent(lastPercent.current)
      reader.current?.send({ type: 'setTheme', theme: toReaderTheme(theme) })
      reader.current?.send({ type: 'open', base64, cfi: progress?.cfi ?? null, locations: found.locations })
      await markOpened(db, id, Date.now())
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [db, id, save, theme])

  const onEvent = useCallback(
    (event: ReaderEvent) => {
      switch (event.type) {
        case 'ready':
          return open()
        case 'relocated': {
          if (event.percent !== null) lastPercent.current = event.percent
          pending.current = { cfi: event.cfi, percent: lastPercent.current }
          setPercent(lastPercent.current)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => void save(), SAVE_DELAY_MS)
          return
        }
        case 'locations':
          return saveLocations(db, id, event.data).catch(report('Não foi possível guardar as posições do livro.'))
        case 'centerTap':
          return setBarVisible((visible) => !visible)
        case 'openExternal':
          return Linking.openURL(event.url).catch(report('Não foi possível abrir o link.'))
        case 'error':
          return setError(event.message)
      }
    },
    [db, id, open, save],
  )

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Não foi possível abrir o livro: {error}</Text>
        <Pressable onPress={() => router.back()} style={styles.button}>
          <Text>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* A barra é absoluta: posicionada dentro desta View, fica abaixo da barra de status. */}
      <View style={styles.screen}>
        <Reader ref={reader} background={theme.background} onEvent={onEvent} />
        {barVisible && (
          <View style={styles.bar}>
            <Pressable onPress={() => router.back()} style={styles.button}>
              <Text>Voltar</Text>
            </Pressable>
            <Text style={styles.barTitle} numberOfLines={1}>
              {book?.title}
            </Text>
            <Text>{percent === null ? '' : `${Math.round(percent * 100)}%`}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorText: { textAlign: 'center' },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  barTitle: { flex: 1, fontWeight: '600' },
  button: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f0e6ff' },
})

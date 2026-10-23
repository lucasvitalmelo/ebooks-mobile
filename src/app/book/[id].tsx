import * as Clipboard from 'expo-clipboard'
import * as Crypto from 'expo-crypto'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AppState, Linking, Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppearanceSheet } from '@/components/AppearanceSheet'
import { NavigationSheet } from '@/components/NavigationSheet'
import { Reader, type ReaderHandle } from '@/components/Reader'
import { SelectionBar } from '@/components/SelectionBar'
import { getBook, markOpened, saveLocations, type Book } from '@/lib/db/books'
import { addHighlight, deleteHighlight, listHighlights, type Highlight } from '@/lib/db/highlights'
import { getProgress, saveProgress } from '@/lib/db/progress'
import { useDb } from '@/lib/db/provider'
import { toReaderTheme } from '@/lib/db/themes'
import { readBase64 } from '@/lib/files'
import { chromeFor } from '@/lib/tone'
import { shouldHideBar } from '@/reader/bar'
import { byBookOrder } from '@/reader/cfi-order'
import type { ReaderEvent } from '@/reader/protocol'
import { currentEntry, type TocEntry } from '@/reader/toc'
import { themeStore, useThemeStore } from '@/store/theme-store'

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
  const theme = useThemeStore((s) => s.active)
  const chrome = chromeFor(theme.background)
  const [book, setBook] = useState<Book | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  // Aberta ao entrar, para quem abre o livro ver que a barra existe; some no primeiro virar de página.
  const [barVisible, setBarVisible] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [toc, setToc] = useState<TocEntry[]>([])
  const [currentHref, setCurrentHref] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [selection, setSelection] = useState<{ cfiRange: string; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<{ cfi: string; percent: number | null } | null>(null)
  // A porcentagem só existe depois das locations; um relocated sem ela não
  // pode apagar a que já se sabia.
  const lastPercent = useRef<number | null>(null)
  // Última posição recebida: só um CFI diferente conta como virar de página (ver shouldHideBar).
  const lastCfi = useRef<string | null>(null)
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
      lastCfi.current = null
      setSelection(null)
      const found = await getBook(db, id)
      if (!found) return setError('Livro não encontrado.')
      setBook(found)
      const [progress, base64, rows] = await Promise.all([
        getProgress(db, id),
        readBase64(found.filePath),
        listHighlights(db, id),
      ])
      lastPercent.current = progress?.percent ?? null
      setPercent(lastPercent.current)
      setHighlights(rows)
      reader.current?.send({ type: 'setTheme', theme: toReaderTheme(themeStore.getState().active) })
      reader.current?.send({
        type: 'open',
        base64,
        cfi: progress?.cfi ?? null,
        locations: found.locations,
        highlights: rows.map(({ id: highlightId, cfiRange }) => ({ id: highlightId, cfiRange })),
      })
      await markOpened(db, id, Date.now())
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [db, id, save])

  useEffect(() => {
    reader.current?.send({ type: 'setTheme', theme: toReaderTheme(theme) })
  }, [theme])

  const removeHighlight = useCallback(
    (highlight: Highlight) => {
      Alert.alert('Remover grifo?', highlight.text.slice(0, 120), [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () =>
            deleteHighlight(db, highlight.id)
              .then(() => {
                reader.current?.send({ type: 'removeHighlight', id: highlight.id })
                setHighlights((current) => current.filter((h) => h.id !== highlight.id))
              })
              .catch(report('Não foi possível remover o grifo.')),
        },
      ])
    },
    [db],
  )

  const onEvent = useCallback(
    (event: ReaderEvent) => {
      switch (event.type) {
        case 'ready':
          return open()
        case 'relocated': {
          if (shouldHideBar(lastCfi.current, event.cfi)) setBarVisible(false)
          lastCfi.current = event.cfi
          setCurrentHref(event.href)
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
        case 'toc':
          return setToc(event.entries)
        case 'selection':
          return setSelection(event.cfiRange ? { cfiRange: event.cfiRange, text: event.text } : null)
        case 'highlightTap': {
          const highlight = highlights.find((h) => h.id === event.id)
          if (highlight) removeHighlight(highlight)
          return
        }
        case 'error':
          return setError(event.message)
      }
    },
    [db, id, open, save, highlights, removeHighlight],
  )

  async function onHighlight() {
    const current = selection
    if (!current) return
    // Some já: a seleção só some na página quando ela responde, e um segundo toque duplicaria o grifo.
    setSelection(null)
    if (highlights.some((h) => h.cfiRange === current.cfiRange)) {
      reader.current?.send({ type: 'clearSelection' })
      return
    }
    const highlight: Highlight = {
      id: Crypto.randomUUID(),
      bookId: id,
      cfiRange: current.cfiRange,
      text: current.text,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    try {
      await addHighlight(db, highlight)
      reader.current?.send({ type: 'addHighlight', id: highlight.id, cfiRange: highlight.cfiRange })
      setHighlights((current) => byBookOrder([...current, highlight]))
    } catch (e) {
      report('Não foi possível grifar.')(e)
    }
  }

  async function onCopy() {
    if (!selection) return
    try {
      await Clipboard.setStringAsync(selection.text)
      ToastAndroid.show('Copiado', ToastAndroid.SHORT)
    } catch (e) {
      report('Não foi possível copiar.')(e)
    } finally {
      reader.current?.send({ type: 'clearSelection' })
    }
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: chrome.text }]}>Não foi possível abrir o livro: {error}</Text>
        <Pressable onPress={() => router.back()} style={[styles.button, { backgroundColor: chrome.control }]}>
          <Text style={{ color: chrome.text }}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style={chrome.statusBar} />
      {/* As barras são absolutas: posicionadas dentro desta View, ficam abaixo da barra de status. */}
      <View style={styles.screen}>
        <Reader ref={reader} background={theme.background} onEvent={onEvent} />
        {barVisible && (
          <View style={[styles.bar, { backgroundColor: chrome.surface }]}>
            <Pressable onPress={() => router.back()} style={[styles.button, { backgroundColor: chrome.control }]}>
              <Text style={{ color: chrome.text }}>Voltar</Text>
            </Pressable>
            <Text style={[styles.barTitle, { color: chrome.text }]} numberOfLines={1}>
              {book?.title}
            </Text>
            <Pressable
              accessibilityLabel="Sumário e grifos"
              onPress={() => setNavOpen(true)}
              style={[styles.button, { backgroundColor: chrome.control }]}
            >
              <Text style={{ color: chrome.text }}>Sumário</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Aparência"
              onPress={() => setSheetOpen(true)}
              style={[styles.button, { backgroundColor: chrome.control }]}
            >
              <Text style={{ color: chrome.text }}>Aa</Text>
            </Pressable>
            <Text style={{ color: chrome.text }}>{percent === null ? '' : `${Math.round(percent * 100)}%`}</Text>
          </View>
        )}
        {selection && <SelectionBar chrome={chrome} onHighlight={onHighlight} onCopy={onCopy} />}
      </View>
      <AppearanceSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
      <NavigationSheet
        visible={navOpen}
        onClose={() => setNavOpen(false)}
        chrome={chrome}
        toc={toc}
        currentIndex={currentEntry(toc, currentHref)}
        highlights={highlights}
        onGoTo={(target) => reader.current?.send({ type: 'goTo', target })}
        onRemoveHighlight={removeHighlight}
      />
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
    gap: 8,
    padding: 12,
  },
  barTitle: { flex: 1, fontWeight: '600' },
  button: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
})

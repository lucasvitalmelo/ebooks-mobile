import * as Clipboard from 'expo-clipboard'
import * as Crypto from 'expo-crypto'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ArrowLeft, List, NotebookPen, Settings2 } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  AppState,
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppearanceSheet } from '@/components/AppearanceSheet'
import { NavigationSheet, type NavigationTab } from '@/components/NavigationSheet'
import { ProgressBar } from '@/components/ProgressBar'
import { Reader, type ReaderHandle } from '@/components/Reader'
import { ReturnPill } from '@/components/ReturnPill'
import { SelectionPopover } from '@/components/SelectionPopover'
import { getBook, markOpened, saveLocations, type Book } from '@/lib/db/books'
import { addHighlight, deleteHighlight, listHighlights, type Highlight } from '@/lib/db/highlights'
import { getProgress, saveProgress } from '@/lib/db/progress'
import { useDb } from '@/lib/db/provider'
import { toReaderTheme } from '@/lib/db/themes'
import { readBase64 } from '@/lib/files'
import { paletteFor } from '@/lib/palette'
import { shouldHideBar } from '@/reader/bar'
import { byBookOrder, containsCfi } from '@/reader/cfi-order'
import {
  IDLE_CHECKPOINT,
  savedOrigin,
  stepCheckpoint,
  type CheckpointEvent,
  type CheckpointState,
} from '@/reader/checkpoint'
import type { Rect } from '@/reader/hit'
import type { ReaderEvent } from '@/reader/protocol'
import { currentEntry, type TocEntry } from '@/reader/toc'
import { themeStore, useThemeStore } from '@/store/theme-store'
import { UI_FONT } from '@/ui/fonts'

const SAVE_DELAY_MS = 1000
const KEEP_AWAKE_TAG = 'reader'

type Popover =
  | { mode: 'selection'; cfiRange: string; text: string; rect: Rect }
  | { mode: 'highlight'; highlight: Highlight; rect: Rect }

interface Position {
  // A âncora; o começo real da página é `startCfi` (após um goTo a âncora fica no meio dela).
  cfi: string
  startCfi: string | null
  endCfi: string | null
  percent: number | null
}

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
  const keepAwake = useThemeStore((s) => s.keepAwake)
  const palette = paletteFor(theme)
  const [book, setBook] = useState<Book | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  // Abertas ao entrar, para quem abre o livro ver que existem; somem no primeiro movimento.
  const [barsVisible, setBarsVisible] = useState(true)
  const [barsOpacity] = useState(() => new Animated.Value(1))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [nav, setNav] = useState<NavigationTab | null>(null)
  const [toc, setToc] = useState<TocEntry[]>([])
  const [currentHref, setCurrentHref] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [popover, setPopover] = useState<Popover | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [checkpoint, setCheckpoint] = useState<CheckpointState>(IDLE_CHECKPOINT)
  const checkpointRef = useRef<CheckpointState>(IDLE_CHECKPOINT)
  const position = useRef<Position | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<{ cfi: string; percent: number | null } | null>(null)
  // A porcentagem só existe depois das locations; um relocated sem ela não
  // pode apagar a que já se sabia.
  const lastPercent = useRef<number | null>(null)
  // O CFI do último relocated; o mesmo CFI de novo (o reenvio quando as
  // locations ficam prontas) não é movimento.
  const lastCfi = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    Animated.timing(barsOpacity, { toValue: barsVisible ? 1 : 0, duration: 200, useNativeDriver: true }).start()
  }, [barsVisible, barsOpacity])

  useEffect(() => {
    if (!keepAwake) return
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG)
    return () => void deactivateKeepAwake(KEEP_AWAKE_TAG)
  }, [keepAwake])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const saved = pending.current
    if (!saved) return
    pending.current = null
    try {
      await saveProgress(db, { bookId: id, ...saved }, Date.now())
    } catch (e) {
      // Volta para a fila, a não ser que uma posição mais nova já tenha chegado.
      pending.current ??= saved
      throw e
    }
  }, [db, id])

  const save = useCallback(() => flush().catch(report('Não foi possível salvar a posição de leitura.')), [flush])

  // Enquanto existe um ponto de retorno, o que se grava é a origem: fechar o
  // app dentro de uma nota reabre onde se lia (como no leitor web).
  const queueSave = useCallback(
    (current: Position) => {
      const origin = savedOrigin(checkpointRef.current)
      pending.current = origin
        ? { cfi: origin.cfi, percent: origin.percentage ?? lastPercent.current }
        : { cfi: current.cfi, percent: lastPercent.current }
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void save(), SAVE_DELAY_MS)
    },
    [save],
  )

  const dispatch = useCallback(
    (event: CheckpointEvent) => {
      const { state, effects } = stepCheckpoint(checkpointRef.current, event)
      checkpointRef.current = state
      setCheckpoint(state)
      for (const effect of effects) {
        if (effect.type === 'goTo') reader.current?.send({ type: 'goTo', target: effect.cfi })
        else if (effect.type === 'saveCurrent' && position.current) queueSave(position.current)
        // pushGuard/popGuard são do histórico do navegador; aqui o voltar do Android vai pelo BackHandler.
      }
    },
    [queueSave],
  )

  // Só lê refs: estável entre renders.
  const showsOrigin = useCallback(() => {
    const origin = savedOrigin(checkpointRef.current)
    const at = position.current
    return Boolean(origin && at && containsCfi(at.startCfi ?? at.cfi, at.endCfi, origin.cfi))
  }, [])

  // Todo salto pelo sumário, pelas anotações ou por um link guarda de onde se saiu.
  const startJump = useCallback(() => {
    const at = position.current
    if (at) dispatch({ type: 'jump', origin: { cfi: at.cfi, percentage: at.percent ?? undefined } })
  }, [dispatch])

  const jumpTo = useCallback(
    (target: string) => {
      startJump()
      reader.current?.send({ type: 'goTo', target })
    },
    [startJump],
  )

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

  // Com um ponto de retorno, o voltar do Android volta para onde se lia em vez de sair do livro.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (checkpointRef.current.status !== 'active') return false
      dispatch({ type: 'systemBack' })
      return true
    })
    return () => subscription.remove()
  }, [dispatch])

  // Também chega de novo quando a WebView é remontada (o Android matou o processo
  // dela): a posição pendente vai para o banco antes de reabrir a partir dele.
  const open = useCallback(async () => {
    try {
      await save()
      lastCfi.current = null
      position.current = null
      dispatch({ type: 'close' })
      setPopover(null)
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
  }, [db, id, save, dispatch])

  useEffect(() => {
    reader.current?.send({ type: 'setTheme', theme: toReaderTheme(theme) })
  }, [theme])

  const removeHighlight = useCallback(
    (highlight: Highlight) =>
      deleteHighlight(db, highlight.id)
        .then(() => {
          reader.current?.send({ type: 'removeHighlight', id: highlight.id })
          setHighlights((current) => current.filter((h) => h.id !== highlight.id))
          ToastAndroid.show('Grifo removido', ToastAndroid.SHORT)
        })
        .catch(report('Não foi possível remover o grifo.')),
    [db],
  )

  const onEvent = useCallback(
    (event: ReaderEvent) => {
      switch (event.type) {
        case 'ready':
          return open()
        case 'relocated': {
          if (shouldHideBar(lastCfi.current, event.cfi)) setBarsVisible(false)
          // O cartão aponta para um trecho da página que saiu da tela.
          if (event.cfi !== lastCfi.current) setPopover(null)
          lastCfi.current = event.cfi
          setCurrentHref(event.href)
          if (event.percent !== null) lastPercent.current = event.percent
          position.current = {
            cfi: event.cfi,
            startCfi: event.startCfi,
            endCfi: event.endCfi,
            percent: lastPercent.current,
          }
          setPercent(lastPercent.current)
          if (checkpointRef.current.status !== 'idle') dispatch({ type: 'relocated', showsOrigin: showsOrigin() })
          queueSave(position.current)
          return
        }
        case 'linkJump':
          return startJump()
        case 'jumpEnded':
          if (checkpointRef.current.status === 'idle') return
          return dispatch(event.ok ? { type: 'jumpSettled', showsOrigin: showsOrigin() } : { type: 'jumpFailed' })
        case 'locations':
          return saveLocations(db, id, event.data).catch(report('Não foi possível guardar as posições do livro.'))
        case 'centerTap':
          // Com o cartão aberto, o toque fora só o fecha.
          if (popover) return setPopover(null)
          return setBarsVisible((visible) => !visible)
        case 'openExternal':
          return Linking.openURL(event.url).catch(report('Não foi possível abrir o link.'))
        case 'toc':
          return setToc(event.entries)
        case 'selection':
          return setPopover(
            event.cfiRange && event.rect
              ? { mode: 'selection', cfiRange: event.cfiRange, text: event.text, rect: event.rect }
              : null,
          )
        case 'highlightTap': {
          const highlight = highlights.find((h) => h.id === event.id)
          if (highlight) setPopover({ mode: 'highlight', highlight, rect: event.rect })
          return
        }
        case 'error':
          return setError(event.message)
      }
    },
    [db, id, open, queueSave, dispatch, startJump, showsOrigin, highlights, popover],
  )

  async function onHighlight() {
    const current = popover
    if (current?.mode !== 'selection') return
    setPopover(null)
    if (highlights.some((h) => h.cfiRange === current.cfiRange)) {
      ToastAndroid.show('Esse trecho já está grifado', ToastAndroid.SHORT)
      return reader.current?.send({ type: 'clearSelection' })
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
      setHighlights((list) => byBookOrder([...list, highlight]))
      ToastAndroid.show('Grifo salvo', ToastAndroid.SHORT)
    } catch (e) {
      report('Não foi possível salvar o grifo.')(e)
    }
  }

  async function onCopy() {
    const current = popover
    if (!current) return
    setPopover(null)
    try {
      await Clipboard.setStringAsync(current.mode === 'selection' ? current.text : current.highlight.text)
      ToastAndroid.show('Copiado', ToastAndroid.SHORT)
    } catch (e) {
      report('Não foi possível copiar.')(e)
    } finally {
      if (current.mode === 'selection') reader.current?.send({ type: 'clearSelection' })
    }
  }

  function onRemove() {
    const current = popover
    if (current?.mode !== 'highlight') return
    setPopover(null)
    void removeHighlight(current.highlight)
  }

  const onReaderLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setViewport({ width, height })
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={[styles.errorText, { color: palette.text }]}>Não foi possível abrir o livro: {error}</Text>
        <Pressable onPress={() => router.back()} style={[styles.textButton, { backgroundColor: palette.panel }]}>
          <Text style={[styles.textButtonLabel, { color: palette.text }]}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const origin = savedOrigin(checkpoint)
  const pointerEvents = barsVisible ? 'auto' : 'none'
  const returning = checkpoint.status === 'active'

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <StatusBar style={palette.statusBar} />
      {/* As barras somem por opacidade mas guardam o espaço: o texto não refaz o layout. */}
      <Animated.View
        pointerEvents={pointerEvents}
        style={[styles.header, { borderBottomColor: palette.border, opacity: barsOpacity }]}
      >
        <Pressable accessibilityLabel="Voltar para a biblioteca" onPress={() => router.back()} style={styles.icon}>
          <ArrowLeft size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
          {book?.title}
        </Text>
        <Pressable accessibilityLabel="Ajustes de leitura" onPress={() => setSheetOpen(true)} style={styles.icon}>
          <Settings2 size={20} color={palette.text} />
        </Pressable>
      </Animated.View>
      <View style={styles.reader} onLayout={onReaderLayout}>
        <Reader ref={reader} background={theme.background} onEvent={onEvent} />
        {popover && (
          <SelectionPopover
            mode={popover.mode}
            rect={popover.rect}
            viewport={viewport}
            palette={palette}
            onCopy={onCopy}
            onHighlight={onHighlight}
            onRemove={onRemove}
          />
        )}
      </View>
      {/* Como no leitor web: somem os botões e a barra; o botão de retorno fica visível e tocável. */}
      <View style={styles.footer}>
        <Animated.View
          pointerEvents="none"
          style={[styles.footerBorder, { backgroundColor: palette.border, opacity: barsOpacity }]}
        />
        <Animated.View pointerEvents={pointerEvents} style={[styles.footerSide, { opacity: barsOpacity }]}>
          <Pressable onPress={() => setNav('toc')} style={styles.footerButton}>
            <List size={20} color={palette.text} />
            <Text style={[styles.footerLabel, { color: palette.text }]}>Sumário</Text>
          </Pressable>
        </Animated.View>
        <View style={[styles.footerCenter, returning && styles.footerCenterReturning]}>
          <Animated.View pointerEvents="none" style={{ opacity: barsOpacity }}>
            <ProgressBar
              value={percent}
              palette={palette}
              width={64}
              marker={returning ? (origin?.percentage ?? null) : null}
            />
          </Animated.View>
          {returning && origin ? (
            <ReturnPill
              percent={origin.percentage ?? null}
              palette={palette}
              onBack={() => dispatch({ type: 'back' })}
              onDismiss={() => dispatch({ type: 'dismiss' })}
            />
          ) : (
            <Animated.Text style={[styles.percent, { color: palette.muted, opacity: barsOpacity }]}>
              {percent === null ? '' : `${Math.round(percent * 100)}%`}
            </Animated.Text>
          )}
        </View>
        <Animated.View pointerEvents={pointerEvents} style={[styles.footerSide, { opacity: barsOpacity }]}>
          <Pressable onPress={() => setNav('highlights')} style={styles.footerButton}>
            <NotebookPen size={20} color={palette.text} />
            <Text style={[styles.footerLabel, { color: palette.text }]}>Anotações</Text>
          </Pressable>
        </Animated.View>
      </View>
      <AppearanceSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
      <NavigationSheet
        visible={nav !== null}
        initialTab={nav ?? 'toc'}
        onClose={() => setNav(null)}
        palette={palette}
        toc={toc}
        currentIndex={currentEntry(toc, currentHref)}
        highlights={highlights}
        onGoTo={jumpTo}
        onRemoveHighlight={(highlight) => void removeHighlight(highlight)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorText: { textAlign: 'center', fontFamily: UI_FONT.regular },
  textButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  textButtonLabel: { fontFamily: UI_FONT.medium },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 14, fontFamily: UI_FONT.medium },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  reader: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  footerBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  footerSide: { flex: 1 },
  footerButton: { height: 56, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 10 },
  footerLabel: { fontSize: 12, fontFamily: UI_FONT.regular },
  footerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  // Como o `1fr auto 1fr` do web: o botão de retorno ocupa o que precisa.
  footerCenterReturning: { flex: 0, paddingHorizontal: 4 },
  percent: { fontSize: 12, fontFamily: UI_FONT.regular },
})

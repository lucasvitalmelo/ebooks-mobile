import * as DocumentPicker from 'expo-document-picker'
import { router, useFocusEffect } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BookCard } from '@/components/BookCard'
import { ContinueCard } from '@/components/ContinueCard'
import { listBooksWithProgress, type BookWithProgress } from '@/lib/db/books'
import { useDb } from '@/lib/db/provider'
import { deleteFiles, discardPicked, fileAt, readBytes, storeBook, storeCover } from '@/lib/files'
import { formatSummary, importBooks, removeBook, type ImportDeps } from '@/lib/import'
import { pickContinue } from '@/lib/library'
import { paletteFor } from '@/lib/palette'
import { useThemeStore } from '@/store/theme-store'
import { UI_FONT } from '@/ui/fonts'

type Cell = BookWithProgress | { id: '__add' }

const PADDING = 16
const COLUMN_GAP = 16

export default function Library() {
  const db = useDb()
  const theme = useThemeStore((s) => s.active)
  const palette = paletteFor(theme)
  const [books, setBooks] = useState<BookWithProgress[] | null>(null)
  const [importing, setImporting] = useState(false)
  const busy = useRef(false)
  // Largura fixa: a célula sozinha na última linha não estica para a linha inteira.
  const cellWidth = (useWindowDimensions().width - PADDING * 2 - COLUMN_GAP) / 2

  const reload = useCallback(async () => setBooks(await listBooksWithProgress(db)), [db])
  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )

  const deps: ImportDeps = { db, readBytes, storeBook, storeCover, deleteFiles, discardPicked, now: Date.now }
  const coverOf = (book: BookWithProgress) => (book.coverPath ? fileAt(book.coverPath).uri : null)
  const open = (book: BookWithProgress) => router.push(`/book/${book.id}`)

  async function onImport() {
    // O Android recusa um segundo seletor aberto: a trava vale já no toque, não só depois da escolha.
    if (busy.current) return
    busy.current = true
    setImporting(true)
    try {
      // Filtro aberto: no Android vários provedores informam EPUB como
      // application/octet-stream, e o filtro por tipo esconderia o arquivo.
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true })
      if (result.canceled) return
      const summary = await importBooks(
        deps,
        result.assets.map((asset) => ({ uri: asset.uri, name: asset.name })),
      )
      Alert.alert('Importação', formatSummary(summary))
      await reload()
    } catch (error) {
      console.error(error)
      ToastAndroid.show('Não foi possível importar os livros.', ToastAndroid.LONG)
    } finally {
      busy.current = false
      setImporting(false)
    }
  }

  function onMenu(book: BookWithProgress) {
    Alert.alert(
      `Remover "${book.title}"?`,
      'O arquivo e o progresso de leitura salvo serão removidos permanentemente. Essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeBook(deps, book)
            } catch (error) {
              console.error(error)
              ToastAndroid.show('Não foi possível remover o livro.', ToastAndroid.LONG)
            } finally {
              await reload()
            }
          },
        },
      ],
    )
  }

  const current = books ? pickContinue(books) : null
  const cells: Cell[] = books ? [...books, { id: '__add' }] : []

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
          E-books
          {books && books.length > 0 && (
            <Text style={[styles.count, { color: palette.muted }]}>
              {' '}
              · {books.length} {books.length === 1 ? 'livro' : 'livros'}
            </Text>
          )}
        </Text>
        <Pressable
          accessibilityLabel="Adicionar EPUB"
          onPress={onImport}
          disabled={importing}
          style={({ pressed }) => [
            styles.add,
            { backgroundColor: palette.primary, opacity: importing ? 0.5 : 1 },
            pressed && styles.pressed,
          ]}
        >
          {importing ? <ActivityIndicator color={palette.onPrimary} /> : <Plus size={20} color={palette.onPrimary} />}
        </Pressable>
      </View>
      {books?.length === 0 ? (
        <Pressable onPress={onImport} style={[styles.empty, { borderColor: palette.panelBorder }]}>
          <View style={[styles.emptyIcon, { backgroundColor: palette.panel }]}>
            <Plus size={24} color={palette.text} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Adicionar seu primeiro EPUB</Text>
          <Text style={[styles.emptyText, { color: palette.muted }]}>
            Escolha um ou mais arquivos .epub do seu aparelho.
          </Text>
        </Pressable>
      ) : (
        <FlatList
          data={cells}
          keyExtractor={(cell) => cell.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          ListHeaderComponent={
            current ? (
              <View style={styles.continue}>
                <ContinueCard
                  book={current}
                  coverUri={coverOf(current)}
                  percent={current.percent}
                  palette={palette}
                  onPress={() => open(current)}
                />
              </View>
            ) : undefined
          }
          renderItem={({ item }) =>
            'title' in item ? (
              <BookCard
                book={item}
                coverUri={coverOf(item)}
                percent={item.percent}
                palette={palette}
                width={cellWidth}
                onPress={() => open(item)}
                onMenu={() => onMenu(item)}
              />
            ) : (
              <Pressable
                accessibilityLabel="Adicionar"
                onPress={onImport}
                style={[styles.addTile, { width: cellWidth, borderColor: palette.panelBorder }]}
              >
                <Plus size={20} color={palette.muted} />
                <Text style={[styles.addTileText, { color: palette.muted }]}>Adicionar</Text>
              </Pressable>
            )
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  title: { flex: 1, fontSize: 20, fontFamily: UI_FONT.semibold },
  count: { fontSize: 14, fontFamily: UI_FONT.regular },
  add: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ translateY: 1 }] },
  grid: { paddingHorizontal: PADDING, paddingBottom: 24, gap: 24 },
  row: { gap: COLUMN_GAP },
  continue: { marginBottom: 0 },
  addTile: {
    aspectRatio: 2 / 3,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addTileText: { fontSize: 14, fontFamily: UI_FONT.medium },
  empty: {
    marginTop: 48,
    marginHorizontal: 16,
    alignItems: 'center',
    gap: 12,
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontFamily: UI_FONT.medium },
  emptyText: { fontSize: 14, textAlign: 'center', fontFamily: UI_FONT.regular },
})

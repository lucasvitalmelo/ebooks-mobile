import * as Crypto from 'expo-crypto'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { router, useFocusEffect } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { BookMenu } from '@/components/BookMenu'
import { ContinueCard } from '@/components/ContinueCard'
import { EditBookSheet, type EditValues } from '@/components/EditBookSheet'
import { PdfConverter, type PdfConverterHandle } from '@/components/PdfConverter'
import { editBook } from '@/lib/edit-book'
import { toHex } from '@/lib/epub/sha256'
import { withLibraryLock } from '@/lib/library-lock'
import { base64ToBytes, pdfToEpub } from '@/lib/pdf/convert'
import { prepareLibrary } from '@/lib/prepare-library'
import { ProtectedEpubError } from '@/lib/epub/edit'
import { UNKNOWN_AUTHOR } from '@/lib/epub/parse'
import { exportFileName } from '@/lib/epub/export-name'
import { listBooksWithProgress, type BookWithProgress } from '@/lib/db/books'
import { useDb } from '@/lib/db/provider'
import {
  copyForExport,
  deleteFiles,
  discardPicked,
  fileAt,
  readBytes,
  readFileBytes,
  replaceBytes,
  storeBook,
  storeCover,
  writeBytes,
} from '@/lib/files'
import { formatSummary, importBooks, removeBook, type ImportDeps } from '@/lib/import'
import { pickContinue } from '@/lib/library'
import { paletteFor } from '@/lib/palette'
import { useThemeStore } from '@/store/theme-store'
import { UI_FONT } from '@/ui/fonts'

type Cell = BookWithProgress | { id: '__add' }

const TOAST_INTERVAL = 2500
const FIXED_MODIFIED = '2000-01-01T00:00:00Z'
const PADDING = 16
const COLUMN_GAP = 16

export default function Library() {
  const db = useDb()
  const theme = useThemeStore((s) => s.active)
  const palette = paletteFor(theme)
  const [books, setBooks] = useState<BookWithProgress[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [menuBook, setMenuBook] = useState<BookWithProgress | null>(null)
  const [editing, setEditing] = useState<BookWithProgress | null>(null)
  const [saving, setSaving] = useState(false)
  // A capa editada pode ficar no mesmo caminho: o contador força o Image a não usar a do cache.
  const [editCount, setEditCount] = useState(0)
  const busy = useRef(false)
  const pdf = useRef<PdfConverterHandle>(null)
  // Largura fixa: a célula sozinha na última linha não estica para a linha inteira.
  const cellWidth = (useWindowDimensions().width - PADDING * 2 - COLUMN_GAP) / 2

  const reload = useCallback(async () => setBooks(await listBooksWithProgress(db)), [db])
  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )

  useEffect(() => {
    prepareLibrary({ db, readFile: readFileBytes, replaceFile: replaceBytes }).catch((error: unknown) =>
      console.warn('Não foi possível limpar a biblioteca', error),
    )
  }, [db])

  const deps: ImportDeps = {
    db,
    readBytes,
    storeBook,
    storeCover,
    deleteFiles,
    discardPicked,
    now: Date.now,
    convertPdf: async (uri, name) => {
      const handle = pdf.current
      if (!handle) throw new Error('Não foi possível converter o PDF')
      const base64 = await new File(uri).base64()
      let lastToast = 0
      const result = await handle.convert(base64, (page, total) => {
        // Um aviso a cada 2,5 s (mais a primeira e a última página), para não empilhar toasts.
        const now = Date.now()
        if (page === 1 || page === total || now - lastToast >= TOAST_INTERVAL) {
          lastToast = now
          ToastAndroid.show(`Convertendo PDF (página ${page} de ${total})`, ToastAndroid.SHORT)
        }
      })
      // Identificador e data derivados do PDF: o mesmo PDF gera o mesmo EPUB e, portanto, o mesmo ID de livro.
      const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, base64ToBytes(base64))
      return pdfToEpub(result, name, `urn:sha256:${toHex(new Uint8Array(digest))}`, result.modified ?? FIXED_MODIFIED)
    },
  }
  const coverOf = (book: BookWithProgress) =>
    book.coverPath ? `${fileAt(book.coverPath).uri}${editCount ? `?v=${editCount}` : ''}` : null
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
      const summary = await withLibraryLock(() =>
        importBooks(
          deps,
          result.assets.map((asset) => ({ uri: asset.uri, name: asset.name })),
        ),
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

  async function exportBook(book: BookWithProgress) {
    try {
      const uri = await copyForExport(book.filePath, exportFileName(book))
      await Sharing.shareAsync(uri, { mimeType: 'application/epub+zip', dialogTitle: 'Exportar livro' })
    } catch (error) {
      console.error(error)
      ToastAndroid.show('Não foi possível exportar o livro.', ToastAndroid.LONG)
    }
  }

  async function saveEdit(values: EditValues) {
    if (!editing) return
    setSaving(true)
    try {
      const cover = values.cover && {
        bytes: await readBytes(values.cover.uri),
        width: values.cover.width,
        height: values.cover.height,
        type: values.cover.type,
      }
      const editDeps = { db, readFile: readFileBytes, writeFile: writeBytes, replaceFile: replaceBytes, deleteFiles }
      await withLibraryLock(() =>
        editBook(editDeps, editing, {
          title: values.title,
          author: values.author,
          cover,
        }),
      )
      setEditing(null)
      setEditCount((count) => count + 1)
      ToastAndroid.show('Informações atualizadas', ToastAndroid.SHORT)
      await reload()
    } catch (error) {
      console.error(error)
      ToastAndroid.show(
        error instanceof ProtectedEpubError
          ? 'Este livro tem proteção contra cópia (DRM) e não pode ser editado.'
          : 'Não foi possível salvar as alterações. O arquivo do livro não foi modificado.',
        ToastAndroid.LONG,
      )
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(book: BookWithProgress) {
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
              await withLibraryLock(() => removeBook(deps, book))
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
            Escolha um ou mais arquivos .epub ou .pdf do seu aparelho.
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
                onMenu={() => setMenuBook(item)}
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
      <BookMenu
        title={menuBook?.title ?? null}
        palette={palette}
        onClose={() => setMenuBook(null)}
        onEdit={() => setEditing(menuBook)}
        onExport={() => {
          const book = menuBook
          if (book) void exportBook(book)
        }}
        onDelete={() => {
          const book = menuBook
          if (book) confirmDelete(book)
        }}
      />
      <PdfConverter ref={pdf} />
      {editing && (
        <EditBookSheet
          book={{
            title: editing.title,
            // O "Autor desconhecido" é o que o app pôs no lugar de um autor que o livro não tem.
            author: editing.author === UNKNOWN_AUTHOR ? '' : editing.author,
            coverUri: coverOf(editing),
            coverType: editing.coverPath?.endsWith('.png') ? 'image/png' : 'image/jpeg',
          }}
          palette={palette}
          saving={saving}
          onCancel={() => setEditing(null)}
          onImageError={() => ToastAndroid.show('Não foi possível abrir essa imagem', ToastAndroid.LONG)}
          onSave={saveEdit}
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

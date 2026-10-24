import * as Crypto from 'expo-crypto'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { router, useFocusEffect } from 'expo-router'
import { Plus, Settings } from 'lucide-react-native'
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { BookCard } from '@/components/BookCard'
import { BookMenu } from '@/components/BookMenu'
import { ContinueCard } from '@/components/ContinueCard'
import { DriveSheet } from '@/components/DriveSheet'
import { EmptyLibrary } from '@/components/EmptyLibrary'
import { EditBookSheet, type EditValues } from '@/components/EditBookSheet'
import { PdfConverter, type PdfConverterHandle } from '@/components/PdfConverter'
import { SyncButton } from '@/components/SyncButton'
import { SyncStrip } from '@/components/SyncStrip'
import { editBook } from '@/lib/edit-book'
import { toHex } from '@/lib/epub/sha256'
import { withLibraryLock } from '@/lib/library-lock'
import { base64ToBytes, pdfToEpub } from '@/lib/pdf/convert'
import { prepareLibrary } from '@/lib/prepare-library'
import { ProtectedEpubError } from '@/lib/epub/edit'
import { UNKNOWN_AUTHOR } from '@/lib/epub/parse'
import { exportFileName } from '@/lib/epub/export-name'
import { hasLocalFile, listBooksWithProgress, removeLocalFile, type BookWithProgress } from '@/lib/db/books'
import { isDriveEnabled } from '@/lib/db/deletions'
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
import { libraryBooks, pickContinue } from '@/lib/library'
import { paletteFor } from '@/lib/palette'
import { needsDownload } from '@/lib/sync/book-file'
import { downloadStore, syncStore, useDownloadStore, useDriveStore } from '@/store/sync'
import { useThemeStore } from '@/store/theme-store'
import { UI_FONT } from '@/ui/fonts'

const TOAST_INTERVAL = 2500
const FIXED_MODIFIED = '2000-01-01T00:00:00Z'
const PADDING = 16
const COLUMN_GAP = 16
// Acima da barra de navegação: o SafeAreaView afasta o conteúdo com padding, e o botão absoluto o ignora.
const FAB_BOTTOM = 28

export default function Library() {
  const db = useDb()
  const theme = useThemeStore((s) => s.active)
  const palette = paletteFor(theme)
  const insets = useSafeAreaInsets()
  const [stored, setBooks] = useState<BookWithProgress[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [menuBook, setMenuBook] = useState<BookWithProgress | null>(null)
  const [editing, setEditing] = useState<BookWithProgress | null>(null)
  const [saving, setSaving] = useState(false)
  // A capa editada pode ficar no mesmo caminho: o contador força o Image a não usar a do cache.
  const [editCount, setEditCount] = useState(0)
  const [driveOpen, setDriveOpen] = useState(false)
  const [shelf, setShelf] = useState<'baixados' | 'disponiveis'>('baixados')
  const driveStatus = useDriveStore((s) => s.status)
  const connected = driveStatus === 'conectado'
  const books = stored && libraryBooks(stored, driveStatus)
  const downloading = useDownloadStore((s) => s.downloading)
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
  // A sincronização ou um download mudou algo na biblioteca.
  useEffect(() => {
    const unsubscribeSync = syncStore.subscribe((state, previous) => {
      if (state.revision !== previous.revision) void reload()
    })
    const unsubscribeDownload = downloadStore.subscribe((state, previous) => {
      if (state.revision !== previous.revision) void reload()
    })
    return () => {
      unsubscribeSync()
      unsubscribeDownload()
    }
  }, [reload])

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
      void syncStore.getState().run(db)
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
      const editDeps = {
        db,
        readFile: readFileBytes,
        writeFile: writeBytes,
        replaceFile: replaceBytes,
        deleteFiles,
        now: Date.now,
      }
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
      void syncStore.getState().run(db)
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

  async function confirmDelete(book: BookWithProgress) {
    // O registro de exclusões, não o status do login: com o login momentaneamente
    // fora, a exclusão ainda chega aos outros aparelhos na próxima sincronização.
    const everywhere = await isDriveEnabled(db).catch(() => false)
    Alert.alert(
      `Remover "${book.title}"?`,
      everywhere
        ? 'O livro, o progresso e os grifos saem deste aparelho e dos outros aparelhos conectados ao Google Drive. Essa ação não pode ser desfeita.'
        : 'O arquivo e o progresso de leitura salvo serão removidos permanentemente. Essa ação não pode ser desfeita.',
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
              void syncStore.getState().run(db)
            }
          },
        },
      ],
    )
  }

  async function removeLocal(book: BookWithProgress) {
    try {
      await withLibraryLock(async () => {
        await removeLocalFile(db, book.id)
        deleteFiles([book.filePath])
      })
      ToastAndroid.show(`"${book.title}" removido deste aparelho`, ToastAndroid.SHORT)
    } catch (error) {
      console.error(error)
      ToastAndroid.show('Não foi possível remover deste aparelho.', ToastAndroid.LONG)
    } finally {
      await reload()
    }
  }

  const someInCloud = books?.some((book) => !hasLocalFile(book)) ?? false
  const anyLocal = books?.some(hasLocalFile) ?? false
  // Sem abas, tudo está aqui. Sem nenhum livro aqui, "Baixados" ficaria vazia: abre em "Disponíveis".
  const effectiveShelf = !someInCloud ? 'baixados' : !anyLocal ? 'disponiveis' : shelf
  const visible = books ? books.filter((book) => hasLocalFile(book) === (effectiveShelf === 'baixados')) : []
  const current = books ? pickContinue(books.filter(hasLocalFile)) : null
  const emptyShelf =
    someInCloud && visible.length === 0
      ? effectiveShelf === 'disponiveis'
        ? 'Todos os livros do Google Drive já estão neste aparelho.'
        : 'Nenhum livro baixado neste aparelho.'
      : null

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
        <SyncButton palette={palette} onPress={() => setDriveOpen(true)} />
        <Pressable accessibilityLabel="Configurações" onPress={() => router.push('/settings')} style={styles.icon}>
          <Settings size={20} color={palette.text} />
        </Pressable>
      </View>
      <SyncStrip palette={palette} />
      {/* "Baixados" é o que dá para ler sem conexão; "Disponíveis", o que está no Drive para baixar. */}
      {someInCloud && (
        <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: palette.panel }]}>
          {(
            [
              ['baixados', 'Baixados'],
              ['disponiveis', 'Disponíveis'],
            ] as const
          ).map(([value, label]) => {
            const selected = effectiveShelf === value
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setShelf(value)}
                style={[styles.tab, selected && { backgroundColor: palette.background }]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: selected ? palette.text : palette.muted },
                    selected && styles.tabTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}
      {books?.length === 0 ? null : (
        <FlatList
          data={visible}
          keyExtractor={(cell) => cell.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          ListHeaderComponent={
            current || emptyShelf ? (
              <View style={styles.continue}>
                {current && (
                  <ContinueCard
                    book={current}
                    coverUri={coverOf(current)}
                    percent={current.percent}
                    palette={palette}
                    onPress={() => open(current)}
                  />
                )}
                {emptyShelf && <Text style={[styles.emptyShelf, { color: palette.muted }]}>{emptyShelf}</Text>}
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <BookCard
              book={item}
              coverUri={coverOf(item)}
              percent={item.percent}
              palette={palette}
              width={cellWidth}
              cloud={!hasLocalFile(item)}
              downloading={downloading.includes(item.id)}
              onPress={() => open(item)}
              onMenu={() => setMenuBook(item)}
              onDownload={() => void downloadStore.getState().download(db, item)}
            />
          )}
        />
      )}
      <BookMenu
        title={menuBook?.title ?? null}
        palette={palette}
        cloud={!!menuBook && !hasLocalFile(menuBook)}
        canEdit={!!menuBook && hasLocalFile(menuBook) && !needsDownload(menuBook)}
        canRemoveLocal={
          !!menuBook && connected && hasLocalFile(menuBook) && !!menuBook.driveFileId && menuBook.pendingUpload === 0
        }
        onClose={() => setMenuBook(null)}
        onEdit={() => setEditing(menuBook)}
        onExport={() => {
          const book = menuBook
          if (book) void exportBook(book)
        }}
        onDownload={() => {
          const book = menuBook
          if (book) void downloadStore.getState().download(db, book)
        }}
        onRemoveLocal={() => {
          const book = menuBook
          if (book) void removeLocal(book)
        }}
        onDelete={() => {
          const book = menuBook
          if (book) void confirmDelete(book)
        }}
      />
      <DriveSheet visible={driveOpen} palette={palette} onClose={() => setDriveOpen(false)} />
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
      {books?.length === 0 && <EmptyLibrary palette={palette} />}
      {/* Por cima de tudo e sempre à mão; faz o papel do antigo "adicionar" do cabeçalho. */}
      <Pressable
        accessibilityLabel="Adicionar livro"
        onPress={onImport}
        disabled={importing}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: palette.primary, bottom: FAB_BOTTOM + insets.bottom },
          pressed && styles.pressed,
        ]}
      >
        {importing ? <ActivityIndicator color={palette.onPrimary} /> : <Plus size={24} color={palette.onPrimary} />}
      </Pressable>
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
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ translateY: 1 }] },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  // O último cartão não fica embaixo do botão flutuante.
  grid: { paddingHorizontal: PADDING, paddingBottom: 100, gap: 24 },
  row: { gap: COLUMN_GAP },
  continue: { marginBottom: 0, gap: 24 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, marginHorizontal: 16, marginBottom: 16, borderRadius: 10 },
  tab: { flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 14, fontFamily: UI_FONT.regular },
  tabTextSelected: { fontFamily: UI_FONT.medium },
  emptyShelf: { fontSize: 14, fontFamily: UI_FONT.regular },
})

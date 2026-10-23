import * as DocumentPicker from 'expo-document-picker'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BookCard } from '@/components/BookCard'
import { listBooks, type Book } from '@/lib/db/books'
import { useDb } from '@/lib/db/provider'
import { deleteFiles, discardPicked, fileAt, readBytes, storeBook, storeCover } from '@/lib/files'
import { formatSummary, importBooks, removeBook, type ImportDeps } from '@/lib/import'

export default function Library() {
  const db = useDb()
  const [books, setBooks] = useState<Book[] | null>(null)
  const [importing, setImporting] = useState(false)
  const busy = useRef(false)

  const reload = useCallback(async () => setBooks(await listBooks(db)), [db])
  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )

  const deps: ImportDeps = { db, readBytes, storeBook, storeCover, deleteFiles, discardPicked, now: Date.now }

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

  function onRemove(book: Book) {
    Alert.alert('Remover livro', `Remover "${book.title}" da biblioteca?`, [
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
    ])
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>E-books</Text>
        <Pressable onPress={onImport} disabled={importing} style={styles.button}>
          {importing ? <ActivityIndicator /> : <Text style={styles.buttonText}>Importar</Text>}
        </Pressable>
      </View>
      {books?.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nenhum livro ainda. Toque em Importar para escolher um .epub.</Text>
        </View>
      ) : (
        <FlatList
          data={books ?? []}
          keyExtractor={(book) => book.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <BookCard
              book={item}
              coverUri={item.coverPath ? fileAt(item.coverPath).uri : null}
              onPress={() => router.push(`/book/${item.id}`)}
              onLongPress={() => onRemove(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0e6ff',
    minWidth: 96,
    alignItems: 'center',
  },
  buttonText: { fontWeight: '600', color: '#4b2a8a' },
  grid: { paddingHorizontal: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { textAlign: 'center', color: '#666' },
})

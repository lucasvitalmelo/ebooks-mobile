import { BookOpen, Search, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WarmthOverlay } from '@/components/WarmthOverlay'
import type { Palette } from '@/lib/palette'
import { groupByChapter, splitMatch, type SearchResult } from '@/reader/search-text'
import { UI_FONT } from '@/ui/fonts'

const MIN_LENGTH = 3
const DEBOUNCE_MS = 400

export interface SearchState {
  // A busca a que `results` responde.
  query: string
  results: SearchResult[]
}

interface Props {
  visible: boolean
  palette: Palette
  search: SearchState
  // Com '' cancela a busca em andamento.
  onSearch(query: string): void
  onGoTo(cfi: string): void
  onClose(): void
}

export function SearchSheet({ visible, palette, search, onSearch, onGoTo, onClose }: Props) {
  const [query, setQuery] = useState('')
  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) {
      onSearch('')
      return
    }
    const timer = setTimeout(() => onSearch(trimmed), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [trimmed, onSearch])

  const close = () => {
    setQuery('')
    onSearch('')
    onClose()
  }

  // Enquanto o texto não é o da última resposta (na espera de 400 ms ou com a
  // busca em andamento), os resultados na tela seriam de outra busca.
  const status =
    trimmed.length < MIN_LENGTH
      ? 'Digite ao menos 3 letras.'
      : trimmed !== search.query
        ? 'Buscando...'
        : search.results.length === 0
          ? 'Nenhum resultado encontrado.'
          : null
  const results = search.results

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Buscar no livro</Text>
          <Pressable accessibilityLabel="Fechar" onPress={close} style={styles.icon}>
            <X size={20} color={palette.text} />
          </Pressable>
        </View>
        <View style={[styles.field, { borderColor: palette.panelBorder, backgroundColor: palette.panel }]}>
          <Search size={16} color={palette.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Digite para buscar..."
            placeholderTextColor={palette.muted}
            autoFocus
            returnKeyType="search"
            style={[styles.input, { color: palette.text }]}
          />
          {query.length > 0 && (
            <Pressable accessibilityLabel="Limpar busca" onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={palette.muted} />
            </Pressable>
          )}
        </View>
        {status ? (
          <Text style={[styles.status, { color: palette.muted }]}>{status}</Text>
        ) : (
          <FlatList
            data={groupByChapter(results)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            keyExtractor={(group, index) => `${index}-${group.chapterLabel}`}
            contentContainerStyle={styles.list}
            renderItem={({ item: group }) => (
              <View style={styles.group}>
                {group.chapterLabel && (
                  <View style={styles.chapter}>
                    <BookOpen size={14} color={palette.muted} />
                    <Text style={[styles.chapterText, { color: palette.muted }]} numberOfLines={1}>
                      {group.chapterLabel}
                    </Text>
                  </View>
                )}
                {group.results.map((result) => {
                  const part = splitMatch(result.excerpt, trimmed)
                  return (
                    <Pressable
                      key={result.cfi}
                      onPress={() => {
                        onGoTo(result.cfi)
                        close()
                      }}
                      style={[styles.result, { borderColor: palette.border }]}
                    >
                      <Text style={[styles.excerpt, { color: palette.text }]} numberOfLines={3}>
                        {part.before}
                        <Text style={styles.match}>{part.match}</Text>
                        {part.after}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}
          />
        )}
      </SafeAreaView>
      <WarmthOverlay />
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: { fontSize: 16, fontFamily: UI_FONT.semibold },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: { flex: 1, height: 44, fontSize: 14, fontFamily: UI_FONT.regular },
  status: { textAlign: 'center', padding: 24, fontFamily: UI_FONT.regular },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  group: { gap: 6 },
  chapter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chapterText: { flex: 1, fontSize: 12, fontFamily: UI_FONT.medium },
  result: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  excerpt: { fontSize: 14, fontFamily: UI_FONT.regular },
  match: { fontFamily: UI_FONT.semibold, textDecorationLine: 'underline' },
})

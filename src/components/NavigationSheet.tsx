import { BookOpen, NotebookPen, X } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WarmthOverlay } from '@/components/WarmthOverlay'
import type { Highlight } from '@/lib/db/highlights'
import type { Palette } from '@/lib/palette'
import type { TocEntry } from '@/reader/toc'
import { UI_FONT } from '@/ui/fonts'

export type NavigationTab = 'toc' | 'highlights'

interface Props {
  visible: boolean
  initialTab: NavigationTab
  onClose(): void
  palette: Palette
  toc: TocEntry[]
  currentIndex: number
  highlights: Highlight[]
  onGoTo(target: string): void
  onRemoveHighlight(highlight: Highlight): void
  onEditNote(highlight: Highlight): void
}

export function NavigationSheet(props: Props) {
  const {
    visible,
    initialTab,
    onClose,
    palette,
    toc,
    currentIndex,
    highlights,
    onGoTo,
    onRemoveHighlight,
    onEditNote,
  } = props
  const [tab, setTab] = useState<NavigationTab>(initialTab)
  // Cada abertura começa na aba pedida.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) setTab(initialTab)
  }

  const go = (target: string) => {
    onGoTo(target)
    onClose()
  }

  const confirmRemove = (highlight: Highlight) =>
    Alert.alert('Remover grifo?', highlight.text.slice(0, 120), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => onRemoveHighlight(highlight) },
    ])

  const tabButton = (value: NavigationTab, label: string) => (
    <Pressable
      onPress={() => setTab(value)}
      accessibilityState={{ selected: tab === value }}
      style={[styles.tab, tab === value && { backgroundColor: palette.background }]}
    >
      <Text style={[styles.tabText, { color: tab === value ? palette.text : palette.muted }]}>{label}</Text>
    </Pressable>
  )

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={styles.header}>
          <View style={[styles.segmented, { backgroundColor: palette.panel }]}>
            {tabButton('toc', 'Sumário')}
            {tabButton('highlights', 'Anotações')}
          </View>
          <Pressable accessibilityLabel="Fechar" onPress={onClose} style={styles.close}>
            <X size={20} color={palette.text} />
          </Pressable>
        </View>
        {tab === 'toc' ? (
          <FlatList
            data={toc}
            keyExtractor={(entry, index) => `${index}-${entry.href}`}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: palette.muted }]}>Este livro não tem sumário.</Text>
            }
            renderItem={({ item, index }) => {
              const current = index === currentIndex
              return (
                <Pressable
                  onPress={() => go(item.href)}
                  style={[
                    styles.item,
                    current && { backgroundColor: palette.panel },
                    item.depth > 0 && {
                      marginLeft: 12 * item.depth,
                      borderRadius: 0,
                      borderLeftWidth: 1,
                      borderLeftColor: palette.border,
                    },
                  ]}
                >
                  {current && <BookOpen size={14} color={palette.text} />}
                  <Text
                    style={[
                      styles.itemText,
                      { color: palette.text, fontFamily: current ? UI_FONT.semibold : UI_FONT.regular },
                    ]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )
            }}
          />
        ) : (
          <FlatList
            data={highlights}
            keyExtractor={(highlight) => highlight.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: palette.muted }]}>Nenhum grifo neste livro ainda.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.highlightRow}>
                <Pressable
                  onPress={() => go(item.cfiRange)}
                  onLongPress={() => confirmRemove(item)}
                  style={[styles.highlight, { borderLeftColor: palette.highlight }]}
                >
                  <Text style={[styles.highlightText, { color: palette.text }]} numberOfLines={3}>
                    {item.text}
                  </Text>
                  {item.note && (
                    <Text style={[styles.note, { color: palette.muted }]} numberOfLines={4}>
                      {item.note}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityLabel={item.note ? 'Editar nota' : 'Escrever nota'}
                  onPress={() => onEditNote(item)}
                  style={styles.noteButton}
                >
                  <NotebookPen size={20} color={palette.text} />
                </Pressable>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  segmented: { flex: 1, flexDirection: 'row', padding: 4, gap: 4, borderRadius: 10 },
  tab: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  tabText: { fontSize: 14, fontFamily: UI_FONT.medium },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  itemText: { flex: 1, fontSize: 14, fontFamily: UI_FONT.regular },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  highlight: { flex: 1, gap: 4, paddingVertical: 4, paddingLeft: 12, borderLeftWidth: 4 },
  highlightText: { fontSize: 14, fontFamily: UI_FONT.regular },
  note: { fontSize: 13, fontFamily: UI_FONT.regular, fontStyle: 'italic' },
  noteButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, textAlign: 'center', fontFamily: UI_FONT.regular },
})

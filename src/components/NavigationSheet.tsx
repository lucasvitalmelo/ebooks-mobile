import { useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Highlight } from '@/lib/db/highlights'
import type { Chrome } from '@/lib/tone'
import type { TocEntry } from '@/reader/toc'

interface Props {
  visible: boolean
  onClose(): void
  chrome: Chrome
  toc: TocEntry[]
  currentIndex: number
  highlights: Highlight[]
  onGoTo(target: string): void
  onRemoveHighlight(highlight: Highlight): void
}

type Tab = 'toc' | 'highlights'

export function NavigationSheet({
  visible,
  onClose,
  chrome,
  toc,
  currentIndex,
  highlights,
  onGoTo,
  onRemoveHighlight,
}: Props) {
  const [tab, setTab] = useState<Tab>('toc')
  const insets = useSafeAreaInsets()

  const go = (target: string) => {
    onGoTo(target)
    onClose()
  }

  const tabButton = (value: Tab, label: string) => (
    <Pressable
      onPress={() => setTab(value)}
      style={[styles.tab, tab === value && { borderBottomColor: chrome.text }]}
      accessibilityState={{ selected: tab === value }}
    >
      <Text style={[styles.tabText, { color: tab === value ? chrome.text : chrome.muted }]}>{label}</Text>
    </Pressable>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: chrome.surface, paddingBottom: 16 + insets.bottom }]}>
        <View style={[styles.tabs, { borderBottomColor: chrome.border }]}>
          {tabButton('toc', 'Sumário')}
          {tabButton('highlights', `Grifos (${highlights.length})`)}
        </View>
        {tab === 'toc' ? (
          <FlatList
            data={toc}
            keyExtractor={(entry, index) => `${index}-${entry.href}`}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: chrome.muted }]}>Este livro não tem sumário.</Text>
            }
            renderItem={({ item, index }) => (
              <Pressable onPress={() => go(item.href)} style={[styles.item, { paddingLeft: 16 + 16 * item.depth }]}>
                <Text
                  style={[styles.itemText, { color: chrome.text }, index === currentIndex && styles.current]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        ) : (
          <FlatList
            data={highlights}
            keyExtractor={(highlight) => highlight.id}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: chrome.muted }]}>
                Nenhum grifo ainda. Toque longo no texto para grifar.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => go(item.cfiRange)}
                onLongPress={() => onRemoveHighlight(item)}
                style={[styles.item, { borderLeftColor: '#f5c400' }, styles.highlightItem]}
              >
                <Text style={[styles.itemText, { color: chrome.text }]} numberOfLines={3}>
                  {item.text}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontWeight: '600' },
  item: { paddingVertical: 12, paddingRight: 16 },
  highlightItem: { marginHorizontal: 16, marginVertical: 4, paddingLeft: 12, borderLeftWidth: 3 },
  itemText: { fontSize: 15 },
  current: { fontWeight: '700' },
  empty: { padding: 24, textAlign: 'center' },
})

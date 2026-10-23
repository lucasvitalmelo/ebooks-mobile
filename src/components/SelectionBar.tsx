import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Chrome } from '@/lib/tone'

interface Props {
  chrome: Chrome
  onHighlight(): void
  onCopy(): void
}

export function SelectionBar({ chrome, onHighlight, onCopy }: Props) {
  return (
    <View style={[styles.bar, { backgroundColor: chrome.surface }]}>
      <Pressable onPress={onHighlight} style={[styles.button, { backgroundColor: chrome.control }]}>
        <Text style={[styles.label, { color: chrome.text }]}>Grifar</Text>
      </Pressable>
      <Pressable onPress={onCopy} style={[styles.button, { backgroundColor: chrome.control }]}>
        <Text style={[styles.label, { color: chrome.text }]}>Copiar</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 12, padding: 12 },
  button: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
  label: { fontWeight: '600' },
})

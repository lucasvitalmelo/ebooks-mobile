import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { chromeFor } from '@/lib/tone'
import { useDb } from '@/lib/db/provider'
import { FONTS } from '@/reader/fonts'
import { adjust, LIMITS, themeStore, useThemeStore } from '@/store/theme-store'

interface Props {
  visible: boolean
  onClose(): void
}

function report(error: unknown) {
  console.error('Não foi possível salvar a aparência.', error)
}

export function AppearanceSheet({ visible, onClose }: Props) {
  const db = useDb()
  const themes = useThemeStore((s) => s.themes)
  const active = useThemeStore((s) => s.active)
  const insets = useSafeAreaInsets()
  const chrome = chromeFor(active.background)
  const { select, update, remove } = themeStore.getState()

  function confirmRemove(id: string, name: string) {
    Alert.alert('Apagar tema', `Apagar "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => remove(db, id).catch(report) },
    ])
  }

  const stepper = (label: string, key: keyof typeof LIMITS, format: (v: number) => string) => (
    <View style={styles.row}>
      <Text style={[styles.label, { color: chrome.text }]}>{label}</Text>
      <Pressable
        accessibilityLabel={`Diminuir ${label}`}
        style={[styles.step, { backgroundColor: chrome.control }]}
        onPress={() => update(db, (t) => ({ [key]: adjust(t[key], -1, LIMITS[key]) })).catch(report)}
      >
        <Text style={[styles.stepText, { color: chrome.text }]}>−</Text>
      </Pressable>
      <Text style={[styles.value, { color: chrome.text }]}>{format(active[key])}</Text>
      <Pressable
        accessibilityLabel={`Aumentar ${label}`}
        style={[styles.step, { backgroundColor: chrome.control }]}
        onPress={() => update(db, (t) => ({ [key]: adjust(t[key], 1, LIMITS[key]) })).catch(report)}
      >
        <Text style={[styles.stepText, { color: chrome.text }]}>+</Text>
      </Pressable>
    </View>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: chrome.surface, paddingBottom: 16 + insets.bottom }]}>
        <Text style={[styles.section, { color: chrome.text }]}>Tema</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {themes.map((theme) => (
            <Pressable
              key={theme.id}
              onPress={() => select(db, theme.id).catch(report)}
              onLongPress={theme.builtin ? undefined : () => confirmRemove(theme.id, theme.name)}
              style={[
                styles.chip,
                { backgroundColor: theme.background, borderColor: chrome.border },
                theme.id === active.id && styles.selected,
              ]}
            >
              <Text style={{ color: theme.text }}>{theme.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={[styles.section, { color: chrome.text }]}>Fonte</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FONTS.map((font) => (
            <Pressable
              key={font.id}
              onPress={() => update(db, { fontFamily: font.id }).catch(report)}
              style={[styles.chip, { borderColor: chrome.border }, font.id === active.fontFamily && styles.selected]}
            >
              <Text style={{ color: chrome.text }}>{font.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {stepper('Tamanho', 'fontSize', (v) => `${v}`)}
        {stepper('Entrelinha', 'lineHeight', (v) => v.toFixed(1))}
        {stepper('Margem', 'margin', (v) => `${v}`)}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 8,
  },
  section: { fontWeight: '600', marginTop: 8 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  selected: { borderColor: '#7c4dcc', borderWidth: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { flex: 1 },
  step: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20 },
  value: { width: 40, textAlign: 'center' },
})

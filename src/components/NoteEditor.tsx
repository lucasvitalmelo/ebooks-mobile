import { useState } from 'react'
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { WarmthOverlay } from '@/components/WarmthOverlay'
import type { Palette } from '@/lib/palette'
import { UI_FONT } from '@/ui/fonts'

interface Props {
  excerpt: string
  note: string | null
  palette: Palette
  onSave(note: string): void
  onCancel(): void
}

// Montado só enquanto aberto: o rascunho começa da nota atual a cada abertura.
export function NoteEditor({ excerpt, note, palette, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(note ?? '')
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.panelBorder }]}>
          <Text style={[styles.title, { color: palette.text }]}>Nota</Text>
          <Text
            style={[styles.excerpt, { color: palette.muted, borderLeftColor: palette.highlight }]}
            numberOfLines={3}
          >
            {excerpt}
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Escreva uma nota sobre o trecho"
            placeholderTextColor={palette.muted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            autoFocus
            style={[styles.input, { color: palette.text, borderColor: palette.panelBorder }]}
          />
          <View style={styles.actions}>
            {note && (
              <Pressable onPress={() => onSave('')} style={styles.textButton}>
                <Text style={[styles.danger]}>Apagar nota</Text>
              </Pressable>
            )}
            <View style={styles.spacer} />
            <Pressable onPress={onCancel} style={[styles.button, { borderColor: palette.panelBorder }]}>
              <Text style={[styles.buttonText, { color: palette.text }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(draft)}
              style={[styles.button, { backgroundColor: palette.primary, borderColor: palette.primary }]}
            >
              <Text style={[styles.buttonText, { color: palette.onPrimary }]}>Salvar</Text>
            </Pressable>
          </View>
          <WarmthOverlay />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12, overflow: 'hidden' },
  title: { fontSize: 16, fontFamily: UI_FONT.semibold },
  excerpt: { fontSize: 14, fontFamily: UI_FONT.regular, borderLeftWidth: 4, paddingLeft: 10 },
  input: {
    minHeight: 120,
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    fontFamily: UI_FONT.regular,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spacer: { flex: 1 },
  textButton: { paddingVertical: 10 },
  danger: { color: '#e7000b', fontSize: 14, fontFamily: UI_FONT.medium },
  button: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  buttonText: { fontSize: 14, fontFamily: UI_FONT.medium },
})

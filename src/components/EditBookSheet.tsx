import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WarmthOverlay } from '@/components/WarmthOverlay'
import type { Palette } from '@/lib/palette'
import { UI_FONT } from '@/ui/fonts'

type CoverType = 'image/jpeg' | 'image/png'

export interface EditValues {
  title: string
  author: string
  cover?: { uri: string; width: number; height: number; type: CoverType }
}

interface Props {
  book: { title: string; author: string; coverUri: string | null; coverType: CoverType }
  palette: Palette
  saving: boolean
  onSave(values: EditValues): void
  onCancel(): void
  onImageError(): void
}

const MAX = { width: 1600, height: 2560 }

// Só a dimensão que limita vai para o resize: a outra sai da proporção real da
// imagem, que pode estar girada pelo EXIF em relação ao tamanho informado.
// Uma capa PNG continua PNG, para trocar a imagem no mesmo item do livro.
async function resizeCover(
  asset: { uri: string; width: number; height: number },
  type: CoverType,
): Promise<EditValues['cover']> {
  const context = ImageManipulator.manipulate(asset.uri)
  if (asset.width > MAX.width || asset.height > MAX.height) {
    if (MAX.width / asset.width < MAX.height / asset.height) context.resize({ width: MAX.width })
    else context.resize({ height: MAX.height })
  }
  const image = await context.renderAsync()
  try {
    const result = await image.saveAsync(
      type === 'image/png' ? { format: SaveFormat.PNG } : { compress: 0.9, format: SaveFormat.JPEG },
    )
    return { uri: result.uri, width: result.width, height: result.height, type }
  } finally {
    image.release()
    context.release()
  }
}

// Montado só enquanto aberto: os campos começam dos dados atuais do livro.
export function EditBookSheet({ book, palette, saving, onSave, onCancel, onImageError }: Props) {
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author)
  const [cover, setCover] = useState<EditValues['cover']>()
  const cancel = () => {
    if (!saving) onCancel()
  }

  async function pickCover() {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    if (picked.canceled) return
    try {
      setCover(await resizeCover(picked.assets[0], book.coverType))
    } catch (error) {
      console.error(error)
      onImageError()
    }
  }

  const field = (label: string, value: string, onChange: (text: string) => void, hint?: string) => (
    <View style={styles.group}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={[styles.input, { color: palette.text, borderColor: palette.panelBorder }]}
      />
      {hint && <Text style={[styles.hint, { color: palette.muted }]}>{hint}</Text>}
    </View>
  )

  const coverUri = cover?.uri ?? book.coverUri
  const disabled = !title.trim() || saving

  return (
    <Modal visible animationType="slide" onRequestClose={cancel}>
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
        <Text style={[styles.title, { color: palette.text }]}>Editar informações</Text>
        <View style={styles.coverRow}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={[styles.cover, { borderColor: palette.border }]} />
          ) : (
            <View style={[styles.cover, { borderColor: palette.border, backgroundColor: palette.panel }]} />
          )}
          <Pressable onPress={pickCover} style={[styles.button, { borderColor: palette.panelBorder }]}>
            <Text style={[styles.buttonText, { color: palette.text }]}>Trocar</Text>
          </Pressable>
        </View>
        {field('Título', title, setTitle)}
        {field('Autor', author, setAuthor, 'Mais de um autor: separe com &.')}
        <View style={styles.actions}>
          <Pressable
            disabled={saving}
            onPress={cancel}
            style={[styles.button, { borderColor: palette.panelBorder, opacity: saving ? 0.5 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: palette.text }]}>Cancelar</Text>
          </Pressable>
          <Pressable
            disabled={disabled}
            onPress={() => onSave({ title: title.trim(), author: author.trim(), cover })}
            style={[
              styles.button,
              { backgroundColor: palette.primary, borderColor: palette.primary, opacity: disabled ? 0.5 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color={palette.onPrimary} />
            ) : (
              <Text style={[styles.buttonText, { color: palette.onPrimary }]}>Salvar</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
      <WarmthOverlay />
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 16 },
  title: { fontSize: 18, fontFamily: UI_FONT.semibold },
  coverRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  cover: { width: 96, aspectRatio: 2 / 3, borderRadius: 10, borderWidth: 1 },
  group: { gap: 6 },
  label: { fontSize: 14, fontFamily: UI_FONT.medium },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: UI_FONT.regular,
  },
  hint: { fontSize: 12, fontFamily: UI_FONT.regular },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 88,
    alignItems: 'center',
  },
  buttonText: { fontSize: 14, fontFamily: UI_FONT.medium },
})

import { Download, Pencil, Trash2 } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WarmthOverlay } from '@/components/WarmthOverlay'
import type { Palette } from '@/lib/palette'
import { UI_FONT } from '@/ui/fonts'

interface Props {
  title: string | null
  palette: Palette
  onEdit(): void
  onExport(): void
  onDelete(): void
  onClose(): void
}

const DESTRUCTIVE = '#e7000b'

export function BookMenu({ title, palette, onEdit, onExport, onDelete, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const item = (label: string, icon: ReactNode, onPress: () => void, color = palette.text) => (
    <Pressable
      onPress={() => {
        onClose()
        onPress()
      }}
      style={styles.item}
    >
      {icon}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  )
  return (
    <Modal visible={title !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: palette.panel, paddingBottom: 12 + insets.bottom }]}>
        <Text style={[styles.title, { color: palette.muted }]} numberOfLines={1}>
          {title}
        </Text>
        {item('Editar', <Pencil size={18} color={palette.text} />, onEdit)}
        {item('Exportar', <Download size={18} color={palette.text} />, onExport)}
        <View style={[styles.separator, { backgroundColor: palette.border }]} />
        {item('Excluir livro', <Trash2 size={18} color={DESTRUCTIVE} />, onDelete, DESTRUCTIVE)}
        <WarmthOverlay />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 12, overflow: 'hidden' },
  title: { paddingHorizontal: 20, paddingBottom: 8, fontSize: 12, fontFamily: UI_FONT.medium },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, height: 52 },
  label: { fontSize: 15, fontFamily: UI_FONT.medium },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
})

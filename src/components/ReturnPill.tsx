import { Undo2, X } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Palette } from '@/lib/palette'
import { UI_FONT } from '@/ui/fonts'

interface Props {
  percent: number | null
  palette: Palette
  onBack(): void
  onDismiss(): void
}

export function ReturnPill({ percent, palette, onBack, onDismiss }: Props) {
  const label = percent === null ? 'Voltar' : `Voltar · ${Math.round(percent * 100)}%`
  return (
    <View style={[styles.pill, { backgroundColor: palette.returnBg }]}>
      <Pressable
        accessibilityLabel={`Voltar para onde você lia${percent === null ? '' : ` (${Math.round(percent * 100)}%)`}`}
        onPress={onBack}
        style={styles.back}
      >
        <Undo2 size={16} color={palette.link} />
        <Text style={[styles.label, { color: palette.link }]}>{label}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Ficar aqui"
        onPress={onDismiss}
        style={[styles.dismiss, { borderLeftColor: `${palette.link}33` }]}
      >
        <X size={16} color={palette.link} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', height: 44, borderRadius: 10, overflow: 'hidden' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 },
  label: { fontSize: 12, fontFamily: UI_FONT.semibold },
  dismiss: { justifyContent: 'center', paddingHorizontal: 10, borderLeftWidth: 1 },
})

import { Copy, Highlighter, Trash2 } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import type { Palette } from '@/lib/palette'
import { HANDLE_ROOM, placePopover } from '@/reader/popover-position'
import type { Rect } from '@/reader/hit'

export const POPOVER_SIZE = { width: 116, height: 62 }

interface Props {
  mode: 'selection' | 'highlight'
  rect: Rect
  viewport: { width: number; height: number }
  palette: Palette
  onCopy(): void
  onHighlight(): void
  onRemove(): void
}

export function SelectionPopover({ mode, rect, viewport, palette, onCopy, onHighlight, onRemove }: Props) {
  // As alças do sistema só existem numa seleção; no toque num grifo o cartão fica colado ao trecho.
  const { top, left } = placePopover(rect, POPOVER_SIZE, viewport, mode === 'selection' ? HANDLE_ROOM : 0)
  const outline = [styles.button, { borderColor: palette.panelBorder }]
  return (
    <View style={[styles.card, { top, left, backgroundColor: palette.panel, borderColor: palette.panelBorder }]}>
      <Pressable accessibilityLabel="Copiar" onPress={onCopy} style={outline}>
        <Copy size={20} color={palette.text} />
      </Pressable>
      {mode === 'selection' ? (
        <Pressable
          accessibilityLabel="Grifar"
          onPress={onHighlight}
          style={[styles.button, { backgroundColor: palette.primary, borderColor: palette.primary }]}
        >
          <Highlighter size={20} color={palette.onPrimary} />
        </Pressable>
      ) : (
        <Pressable accessibilityLabel="Remover grifo" onPress={onRemove} style={outline}>
          <Trash2 size={20} color={palette.text} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    width: POPOVER_SIZE.width,
    height: POPOVER_SIZE.height,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  button: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
})

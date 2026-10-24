import { StyleSheet, View } from 'react-native'
import { WARMTH_COLOR, warmthOpacity } from '@/lib/warmth'
import { useThemeStore } from '@/store/theme-store'

// Cada Modal do Android abre numa janela própria, por cima do filtro do app:
// as folhas põem o seu (as transparentes, só dentro do cartão, não no fundo).
export function WarmthOverlay() {
  const percent = useThemeStore((s) => s.warmthPreview ?? s.warmth)
  if (percent <= 0) return null
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: WARMTH_COLOR, opacity: warmthOpacity(percent) }]}
    />
  )
}

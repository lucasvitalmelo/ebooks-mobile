import { Platform, StyleSheet, View } from 'react-native'
import { brightnessLevels } from '@/lib/brightness'
import { LEGACY_WARMTH_COLOR, legacyWarmthOpacity, warmthColor } from '@/lib/warmth'
import { useThemeStore } from '@/store/theme-store'

// O mixBlendMode só vale do Android 10 (API 29) em diante.
const BLENDS = Platform.OS !== 'android' || Platform.Version >= 29

// Cada Modal do Android abre numa janela própria, por cima do filtro do app:
// as folhas põem o seu (as transparentes, só dentro do cartão, não no fundo).
// Duas camadas: a cor quente multiplicada (o preto continua preto) e, com o
// brilho abaixo do mínimo do aparelho, uma camada preta.
export function WarmthOverlay() {
  const warmth = useThemeStore((s) => s.warmthPreview ?? s.warmth)
  const brightness = useThemeStore((s) => s.brightnessPreview ?? s.brightness)
  const dim = brightness === null ? 0 : brightnessLevels(brightness).dim
  return (
    <>
      {warmth > 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            BLENDS
              ? { backgroundColor: warmthColor(warmth), mixBlendMode: 'multiply' }
              : { backgroundColor: LEGACY_WARMTH_COLOR, opacity: legacyWarmthOpacity(warmth) },
          ]}
        />
      )}
      {dim > 0 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: dim }]} />
      )}
    </>
  )
}

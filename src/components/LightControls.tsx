import Slider from '@react-native-community/slider'
import { StyleSheet, Switch, Text, View } from 'react-native'
import { useDb } from '@/lib/db/provider'
import type { Palette } from '@/lib/palette'
import { themeStore, useThemeStore } from '@/store/theme-store'
import { UI_FONT } from '@/ui/fonts'

const DEFAULT_BRIGHTNESS = 50

function report(error: unknown) {
  console.error('Não foi possível salvar a luz.', error)
}

export function LightControls({ palette }: { palette: Palette }) {
  const db = useDb()
  const warmth = useThemeStore((s) => s.warmth)
  const warmthPreview = useThemeStore((s) => s.warmthPreview)
  const brightness = useThemeStore((s) => s.brightness)
  const brightnessPreview = useThemeStore((s) => s.brightnessPreview)
  const { setWarmth, setWarmthPreview, setBrightness, setBrightnessPreview } = themeStore.getState()
  const system = brightness === null
  const shownBrightness = brightnessPreview ?? brightness ?? DEFAULT_BRIGHTNESS

  const slider = (
    value: number,
    onPreview: (value: number) => void,
    onDone: (value: number) => Promise<void>,
    disabled = false,
  ) => (
    <Slider
      minimumValue={0}
      maximumValue={100}
      step={5}
      value={value}
      disabled={disabled}
      minimumTrackTintColor={palette.fill}
      maximumTrackTintColor={palette.track}
      thumbTintColor={palette.primary}
      onValueChange={(next) => onPreview(Math.round(next))}
      onSlidingComplete={(next) => void onDone(Math.round(next))}
    />
  )

  return (
    <View style={styles.box}>
      <View style={styles.group}>
        <Text style={[styles.label, { color: palette.text }]}>Temperatura da luz ({warmthPreview ?? warmth}%)</Text>
        {slider(warmth, setWarmthPreview, (value) =>
          setWarmth(db, value)
            .catch(report)
            .finally(() => setWarmthPreview(null)),
        )}
        <Text style={[styles.hint, { color: palette.muted }]}>Tira o azul da tela; o preto continua preto.</Text>
      </View>
      <View style={[styles.group, system && styles.disabled]}>
        <Text style={[styles.label, { color: palette.text }]}>
          Brilho ({system ? 'do sistema' : `${shownBrightness}%`})
        </Text>
        {slider(
          shownBrightness,
          setBrightnessPreview,
          (value) =>
            setBrightness(db, value)
              .catch(report)
              .finally(() => setBrightnessPreview(null)),
          system,
        )}
        <Text style={[styles.hint, { color: palette.muted }]}>
          Só com o app aberto. Pode ir abaixo do mínimo do sistema.
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, styles.grow, { color: palette.text }]}>Usar o brilho do sistema</Text>
        <Switch
          value={system}
          onValueChange={(value) => setBrightness(db, value ? null : DEFAULT_BRIGHTNESS).catch(report)}
          trackColor={{ true: palette.fill, false: palette.track }}
          thumbColor={palette.primary}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: 16 },
  group: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  grow: { flex: 1 },
  label: { fontSize: 15, fontFamily: UI_FONT.medium },
  hint: { fontSize: 12, fontFamily: UI_FONT.regular },
  disabled: { opacity: 0.5 },
})

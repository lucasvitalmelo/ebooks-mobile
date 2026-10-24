import Slider from '@react-native-community/slider'
import { Check, ChevronDown, X } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WarmthOverlay } from '@/components/WarmthOverlay'
import { useDb } from '@/lib/db/provider'
import { paletteFor } from '@/lib/palette'
import { FONTS } from '@/reader/fonts'
import { LIMITS, themeStore, useThemeStore } from '@/store/theme-store'
import { UI_FONT } from '@/ui/fonts'

type LimitKey = keyof typeof LIMITS

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
  const keepAwake = useThemeStore((s) => s.keepAwake)
  const warmth = useThemeStore((s) => s.warmth)
  const draftWarmth = useThemeStore((s) => s.warmthPreview)
  const insets = useSafeAreaInsets()
  const palette = paletteFor(active)
  const [fontsOpen, setFontsOpen] = useState(false)
  const { select, update, remove, setKeepAwake, setWarmth, setWarmthPreview } = themeStore.getState()

  function confirmRemove(id: string, name: string) {
    Alert.alert('Apagar tema', `Apagar "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => remove(db, id).catch(report) },
    ])
  }

  const label = (text: string) => <Text style={[styles.label, { color: palette.text }]}>{text}</Text>

  // O valor em arraste: o rótulo acompanha o dedo, e o tema só é gravado ao soltar.
  const [draft, setDraft] = useState<Partial<Record<LimitKey, number>>>({})
  const shown = (key: LimitKey) => draft[key] ?? active[key]
  const round = (value: number) => Math.round(value * 10) / 10

  const slider = (key: LimitKey) => (
    <Slider
      minimumValue={LIMITS[key].min}
      maximumValue={LIMITS[key].max}
      step={LIMITS[key].step}
      value={active[key]}
      minimumTrackTintColor={palette.fill}
      maximumTrackTintColor={palette.track}
      thumbTintColor={palette.primary}
      onValueChange={(value) => setDraft((current) => ({ ...current, [key]: round(value) }))}
      onSlidingComplete={(value) =>
        update(db, { [key]: round(value) })
          .catch(report)
          .finally(() =>
            setDraft((current) => {
              const { [key]: _done, ...rest } = current
              return rest
            }),
          )
      }
    />
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Sem escurecer: a página continua visível enquanto se ajusta, como no leitor web. */}
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: palette.panel, paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Ajustes de leitura</Text>
          <Pressable accessibilityLabel="Fechar" onPress={onClose} style={styles.icon}>
            <X size={20} color={palette.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.group}>
            {label('Paleta')}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches}>
              {themes.map((theme) => (
                <Pressable
                  key={theme.id}
                  accessibilityLabel={theme.name}
                  accessibilityState={{ selected: theme.id === active.id }}
                  onPress={() => select(db, theme.id).catch(report)}
                  onLongPress={theme.builtin ? undefined : () => confirmRemove(theme.id, theme.name)}
                  style={[styles.swatch, { backgroundColor: theme.background, borderColor: palette.panelBorder }]}
                >
                  {theme.id === active.id && <Check size={18} color={theme.text} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={styles.group}>
            {label('Fonte')}
            <Pressable
              onPress={() => setFontsOpen((open) => !open)}
              style={[styles.select, { borderColor: palette.panelBorder }]}
            >
              <Text style={[styles.value, { color: palette.text }]}>
                {FONTS.find((f) => f.id === active.fontFamily)?.label}
              </Text>
              <ChevronDown size={16} color={palette.muted} />
            </Pressable>
            {fontsOpen &&
              FONTS.map((font) => (
                <Pressable
                  key={font.id}
                  onPress={() => {
                    setFontsOpen(false)
                    update(db, { fontFamily: font.id }).catch(report)
                  }}
                  style={styles.option}
                >
                  <Text style={[styles.value, { color: palette.text }]}>{font.label}</Text>
                  {font.id === active.fontFamily && <Check size={16} color={palette.text} />}
                </Pressable>
              ))}
          </View>
          <View style={styles.group}>
            {label(`Tamanho da fonte (${shown('fontSize')}px)`)}
            {slider('fontSize')}
          </View>
          <View style={styles.group}>
            {label(`Espaçamento entre linhas (${shown('lineHeight').toFixed(1)})`)}
            {slider('lineHeight')}
          </View>
          <View style={styles.group}>
            {label(`Margem (${shown('margin')}px)`)}
            {slider('margin')}
          </View>
          <View style={styles.group}>
            {label(`Temperatura da luz (${draftWarmth ?? warmth}%)`)}
            <Slider
              minimumValue={0}
              maximumValue={100}
              step={5}
              value={warmth}
              minimumTrackTintColor={palette.fill}
              maximumTrackTintColor={palette.track}
              thumbTintColor={palette.primary}
              onValueChange={(value) => setWarmthPreview(Math.round(value))}
              onSlidingComplete={(value) =>
                setWarmth(db, Math.round(value))
                  .catch(report)
                  .finally(() => setWarmthPreview(null))
              }
            />
          </View>
          <View style={styles.row}>
            <Text style={[styles.value, styles.rowLabel, { color: palette.text }]}>
              Manter a tela acesa durante a leitura
            </Text>
            <Switch
              value={keepAwake}
              onValueChange={(value) => setKeepAwake(db, value).catch(report)}
              trackColor={{ true: palette.fill, false: palette.track }}
              thumbColor={palette.primary}
            />
          </View>
        </ScrollView>
        <WarmthOverlay />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 0,
  },
  title: { fontSize: 16, fontFamily: UI_FONT.semibold },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 24 },
  group: { gap: 8 },
  label: { fontSize: 14, fontFamily: UI_FONT.medium },
  swatches: { gap: 10, paddingVertical: 2 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  value: { fontSize: 14, fontFamily: UI_FONT.regular },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { flex: 1 },
})

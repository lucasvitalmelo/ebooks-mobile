import { StyleSheet, View } from 'react-native'
import type { Palette } from '@/lib/palette'

interface Props {
  value: number | null
  palette: Palette
  width: number | `${number}%`
  height?: number
  // Onde fica a origem do ponto de retorno, de 0 a 1.
  marker?: number | null
}

export function ProgressBar({ value, palette, width, height = 4, marker = null }: Props) {
  return (
    <View style={{ width }}>
      {marker !== null && <View style={[styles.marker, { left: `${marker * 100}%`, borderTopColor: palette.link }]} />}
      <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: palette.track }]}>
        <View
          style={{
            width: `${Math.round((value ?? 0) * 100)}%`,
            height,
            borderRadius: height / 2,
            backgroundColor: palette.fill,
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
  marker: {
    position: 'absolute',
    top: -7,
    marginLeft: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
})

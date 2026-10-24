import { useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { G, Path } from 'react-native-svg'
import type { Palette } from '@/lib/palette'
import { UI_FONT } from '@/ui/fonts'

const INK = '#c2551f'
// As coordenadas do design são numa tela de 390 × 844. As do cabeçalho se prendem
// à direita e as do botão flutuante à direita e ao fundo da tela real.
const DESIGN_W = 390
const DESIGN_H = 844

// Uma camada por cima da tela inteira, cabeçalho incluído, sem pegar toques: as
// setas saem do texto e chegam nos ícones do cabeçalho e no botão flutuante.
export function EmptyLibrary({ palette }: { palette: Palette }) {
  // O SafeAreaView afasta o conteúdo com padding, e uma camada absoluta o ignora.
  const insets = useSafeAreaInsets()
  const [size, setSize] = useState({ width: DESIGN_W, height: DESIGN_H })
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize({ width, height })
  }
  const dx = size.width - DESIGN_W
  const dy = size.height - DESIGN_H
  const note = (text: string, left: number, top: number, width: number, rotate: string, fontSize = 22) => (
    <Text style={[styles.note, { left, top, width, fontSize, transform: [{ rotate }] }]}>{text}</Text>
  )
  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { top: insets.top, bottom: insets.bottom }]}
      onLayout={onLayout}
    >
      {note('Conecte o Google Drive e leia em qualquer aparelho', 36 + dx, 132, 180, '-3deg')}
      {note('Tema, luz e ajustes ficam aqui', 236 + dx, 214, 140, '2deg')}
      <View style={[styles.center, { top: 330 }]}>
        <Svg width={96} height={96} viewBox="0 0 160 160">
          <Path
            d="M80 60 C60 50 36 48 16 52 L16 124 C36 120 60 122 80 132 C100 122 124 120 144 124 L144 52 C124 48 100 50 80 60 Z"
            fill={palette.panel}
          />
          <Path
            d="M80 52 C62 42 40 40 24 44 L24 116 C40 112 62 114 80 124 Z"
            fill="none"
            stroke={palette.panelBorder}
            strokeWidth={3}
          />
          <Path
            d="M80 52 C98 42 120 40 136 44 L136 116 C120 112 98 114 80 124 Z"
            fill="none"
            stroke={palette.panelBorder}
            strokeWidth={3}
          />
        </Svg>
        <Text style={[styles.title, { color: palette.text }]}>Sua estante está vazia</Text>
        <Text style={[styles.text, { color: palette.muted }]}>
          Os livros que você adicionar aparecem aqui, com o progresso de leitura.
        </Text>
      </View>
      {note('Toque aqui para adicionar seu primeiro livro (.epub ou .pdf)', 40 + dx, 618 + dy, 220, '-2deg', 24)}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
        <G
          fill="none"
          stroke={INK}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={`translate(${dx} 0)`}
        >
          <Path d="M204 140 C236 126 262 108 286 96 C296 91 304 84 310 76" />
          <Path d="M297 77 L311 75 L310 89" />
          <Path d="M318 208 C328 176 352 146 356 116 C358 102 359 90 360 80" />
          <Path d="M351 92 L360 78 L369 91" />
        </G>
        <G
          fill="none"
          stroke={INK}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={`translate(${dx} ${dy})`}
        >
          <Path d="M230 690 C252 716 272 738 292 752 C300 758 306 762 312 766" />
          <Path d="M298 768 L313 767 L307 753" />
        </G>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  note: { position: 'absolute', fontFamily: UI_FONT.hand, color: INK, lineHeight: 26 },
  center: { position: 'absolute', left: 48, right: 48, alignItems: 'center', gap: 14 },
  title: { fontSize: 17, fontFamily: UI_FONT.medium, textAlign: 'center' },
  text: { fontSize: 14, lineHeight: 21, fontFamily: UI_FONT.regular, textAlign: 'center' },
})

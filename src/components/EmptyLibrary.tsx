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
  const note = (text: string, left: number, top: number, width: number, rotate: string, fontSize = 27) => (
    <Text style={[styles.note, { left, top, width, fontSize, lineHeight: fontSize * 1.05, transform: [{ rotate }] }]}>
      {text}
    </Text>
  )
  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { top: insets.top, bottom: insets.bottom }]}
      onLayout={onLayout}
    >
      {note('Conecte o Google Drive e salve seus livros e progressos', 24 + dx, 118, 204, '-8deg')}
      {note('Tema, luz e ajustes ficam aqui', 239 + dx, 192, 140, '2deg')}
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
      {note('Toque aqui para adicionar seu primeiro livro (.epub ou .pdf)', 28 + dx, 596 + dy, 244, '-2deg', 29)}
      {/* Traço fino e curva longa, como desenhado à mão no canvas "E-books · interface v0.7". */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
        <G
          fill="none"
          stroke={INK}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={`translate(${dx} 0)`}
        >
          <Path d="M226 152 C248 144 272.13 141.12 288 128 C307.13 112.19 308.7 75.11 308.7 75.11" />
          <Path d="M299 93 L308.95 73.85 L314 94" />
          <Path d="M292 181 C292 181 297 154 307.45 143.63 C319.75 131.36 342.44 129.03 352.28 114.08 C358.47 104.67 357.26 91.75 358 80" />
          <Path d="M350 93 L358 78 L365 94" />
        </G>
        <G
          fill="none"
          stroke={INK}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={`translate(${dx} ${dy})`}
        >
          <Path d="M276 642 C300 654 314.61 662.46 326.61 678.46 C335.27 690 339.99 710.08 338.94 728.66" />
          <Path d="M330 712 L339.09 731.06 L346 713" />
        </G>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  note: { position: 'absolute', fontFamily: UI_FONT.hand, color: INK },
  center: { position: 'absolute', left: 48, right: 48, alignItems: 'center', gap: 14 },
  title: { fontSize: 17, fontFamily: UI_FONT.medium, textAlign: 'center' },
  text: { fontSize: 14, lineHeight: 21, fontFamily: UI_FONT.regular, textAlign: 'center' },
})

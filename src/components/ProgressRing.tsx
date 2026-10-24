import { useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

const SIZE = 72
const STROKE = 4
const RADIUS = (SIZE - STROKE) / 2
const LENGTH = 2 * Math.PI * RADIUS
// No modo sem progresso, um quarto do anel gira.
const ARC = LENGTH * 0.25
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface Props {
  value: number
  color: string
  track: string
  // Etapa que não informa quanto falta: gira em vez de mostrar o valor.
  indeterminate?: boolean
}

// Anima entre os valores para o anel não pular de uma etapa para a outra.
export function ProgressRing({ value, color, track, indeterminate = false }: Props) {
  const [progress] = useState(() => new Animated.Value(0))
  const [spin] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.timing(progress, {
      toValue: value,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start()
  }, [value, progress])
  useEffect(() => {
    if (!indeterminate) return
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    )
    loop.start()
    return () => {
      loop.stop()
      spin.setValue(0)
    }
  }, [indeterminate, spin])
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={indeterminate ? 'Carregando' : `${Math.round(value * 100)}% carregado`}
      style={{ transform: [{ rotate }] }}
    >
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={track} strokeWidth={STROKE} fill="none" />
        {indeterminate ? (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={[ARC, LENGTH]}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        ) : (
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={LENGTH}
            strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [LENGTH, 0] })}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </Svg>
    </Animated.View>
  )
}

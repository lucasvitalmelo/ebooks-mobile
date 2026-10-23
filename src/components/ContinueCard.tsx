import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Palette } from '@/lib/palette'
import { UI_FONT } from '@/ui/fonts'
import { ProgressBar } from './ProgressBar'

interface Props {
  book: { title: string; author: string }
  coverUri: string | null
  percent: number | null
  palette: Palette
  onPress(): void
}

export function ContinueCard({ book, coverUri, percent, palette, onPress }: Props) {
  return (
    <Pressable
      accessibilityLabel={`Continuar lendo ${book.title}`}
      onPress={onPress}
      style={[styles.card, { backgroundColor: palette.panel }]}
    >
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={[styles.cover, { backgroundColor: palette.border }]} />
      )}
      <View style={styles.body}>
        <Text style={[styles.kicker, { color: palette.muted }]}>Continuar lendo</Text>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={[styles.author, { color: palette.muted }]} numberOfLines={1}>
          {book.author}
        </Text>
        <View style={styles.progress}>
          <View style={styles.bar}>
            <ProgressBar value={percent} palette={palette} width="100%" />
          </View>
          <Text style={[styles.kicker, { color: palette.muted }]}>{Math.round((percent ?? 0) * 100)}% lido</Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 16, padding: 16, borderRadius: 18 },
  cover: {
    width: 80,
    aspectRatio: 2 / 3,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  body: { flex: 1, justifyContent: 'center' },
  kicker: { fontSize: 12, fontFamily: UI_FONT.medium },
  title: { marginTop: 4, fontSize: 16, fontFamily: UI_FONT.semibold },
  author: { fontSize: 14, fontFamily: UI_FONT.regular },
  progress: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { flex: 1 },
})

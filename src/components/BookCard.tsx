import { EllipsisVertical } from 'lucide-react-native'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Palette } from '@/lib/palette'
import { UI_FONT } from '@/ui/fonts'
import { ProgressBar } from './ProgressBar'

interface Props {
  book: { id: string; title: string; author: string }
  coverUri: string | null
  percent: number | null
  palette: Palette
  // Largura fixa da célula: com `flex: 1`, um card sozinho na última linha esticaria.
  width: number
  onPress(): void
  onMenu(): void
}

export function BookCard({ book, coverUri, percent, palette, width, onPress, onMenu }: Props) {
  return (
    <View style={[styles.card, { width }]}>
      <Pressable accessibilityLabel={book.title} onPress={onPress}>
        {coverUri ? (
          <Image
            source={{ uri: coverUri }}
            style={[styles.cover, { borderColor: palette.border, backgroundColor: palette.panel }]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[styles.cover, styles.placeholder, { borderColor: palette.border, backgroundColor: palette.panel }]}
          >
            <Text style={[styles.placeholderTitle, { color: palette.muted }]} numberOfLines={4}>
              {book.title}
            </Text>
          </View>
        )}
      </Pressable>
      {/* Invisível em 0%: o título fica na mesma altura em todos os cards. */}
      <View style={[styles.progress, !percent && styles.hidden]}>
        <ProgressBar value={percent} palette={palette} width="100%" />
      </View>
      <View style={styles.info}>
        <View style={styles.texts}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={[styles.author, { color: palette.muted }]} numberOfLines={1}>
            {book.author}
          </Text>
        </View>
        <Pressable accessibilityLabel={`Opções de ${book.title}`} onPress={onMenu} hitSlop={8} style={styles.menu}>
          <EllipsisVertical size={16} color={palette.muted} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  cover: { aspectRatio: 2 / 3, width: '100%', borderRadius: 10, borderWidth: 1 },
  placeholder: { justifyContent: 'center', padding: 8 },
  placeholderTitle: { textAlign: 'center', fontSize: 14, fontFamily: UI_FONT.medium },
  progress: { marginTop: -2 },
  hidden: { opacity: 0 },
  info: { flexDirection: 'row', gap: 4 },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontFamily: UI_FONT.medium },
  author: { fontSize: 12, fontFamily: UI_FONT.regular },
  menu: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
})

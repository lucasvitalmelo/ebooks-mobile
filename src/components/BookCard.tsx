import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

interface Props {
  book: { id: string; title: string; author: string }
  coverUri: string | null
  colors: { text: string; muted: string; placeholder: string }
  onPress(): void
  onLongPress(): void
}

export function BookCard({ book, coverUri, colors, onPress, onLongPress }: Props) {
  return (
    <Pressable accessibilityLabel={book.title} onPress={onPress} onLongPress={onLongPress} style={styles.card}>
      {coverUri ? (
        <Image
          source={{ uri: coverUri }}
          style={[styles.cover, { backgroundColor: colors.placeholder }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.cover, styles.placeholder, { backgroundColor: colors.placeholder }]}>
          <Text style={[styles.placeholderTitle, { color: colors.muted }]} numberOfLines={4}>
            {book.title}
          </Text>
        </View>
      )}
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {book.title}
      </Text>
      <Text style={[styles.author, { color: colors.muted }]} numberOfLines={1}>
        {book.author}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { flex: 1 / 3, padding: 8 },
  cover: { aspectRatio: 2 / 3, borderRadius: 8 },
  placeholder: { justifyContent: 'center', padding: 8 },
  placeholderTitle: { textAlign: 'center', fontWeight: '600' },
  title: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  author: { fontSize: 12 },
})

import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

interface Props {
  book: { id: string; title: string; author: string }
  coverUri: string | null
  onPress(): void
  onLongPress(): void
}

export function BookCard({ book, coverUri, onPress, onLongPress }: Props) {
  return (
    <Pressable accessibilityLabel={book.title} onPress={onPress} onLongPress={onLongPress} style={styles.card}>
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={[styles.cover, styles.placeholder]}>
          <Text style={styles.placeholderTitle} numberOfLines={4}>
            {book.title}
          </Text>
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {book.title}
      </Text>
      <Text style={styles.author} numberOfLines={1}>
        {book.author}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { flex: 1 / 3, padding: 8 },
  cover: { aspectRatio: 2 / 3, borderRadius: 8, backgroundColor: '#eee' },
  placeholder: { justifyContent: 'center', padding: 8 },
  placeholderTitle: { textAlign: 'center', fontWeight: '600', color: '#555' },
  title: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  author: { fontSize: 12, color: '#666' },
})

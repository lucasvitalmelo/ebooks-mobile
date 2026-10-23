import { fireEvent, render, screen } from '@testing-library/react-native'
import { BookCard } from '@/components/BookCard'

const book = { id: 'a', title: 'O Relógio Parado da Sala', author: 'Joana Vieira' }
const colors = { text: '#f4f4f5', muted: '#a1a1aa', placeholder: '#222222' }

test('sem capa mostra título e autora', async () => {
  await render(<BookCard book={book} coverUri={null} colors={colors} onPress={() => {}} onLongPress={() => {}} />)
  expect(screen.getAllByText('O Relógio Parado da Sala').length).toBeGreaterThan(0)
  expect(screen.getByText('Joana Vieira')).toBeTruthy()
})

test('usa as cores do tema', async () => {
  await render(<BookCard book={book} coverUri={null} colors={colors} onPress={() => {}} onLongPress={() => {}} />)
  expect(screen.getByText('Joana Vieira')).toHaveStyle({ color: '#a1a1aa' })
})

test('toque e toque longo', async () => {
  const onPress = jest.fn()
  const onLongPress = jest.fn()
  await render(<BookCard book={book} coverUri={null} colors={colors} onPress={onPress} onLongPress={onLongPress} />)
  fireEvent.press(screen.getByLabelText('O Relógio Parado da Sala'))
  fireEvent(screen.getByLabelText('O Relógio Parado da Sala'), 'longPress')
  expect(onPress).toHaveBeenCalledTimes(1)
  expect(onLongPress).toHaveBeenCalledTimes(1)
})

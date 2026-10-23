import { fireEvent, render, screen } from '@testing-library/react-native'
import { BookCard } from '@/components/BookCard'

const book = { id: 'a', title: 'O Relógio Parado da Sala', author: 'Joana Vieira' }

test('sem capa mostra título e autora', async () => {
  await render(<BookCard book={book} coverUri={null} onPress={() => {}} onLongPress={() => {}} />)
  expect(screen.getAllByText('O Relógio Parado da Sala').length).toBeGreaterThan(0)
  expect(screen.getByText('Joana Vieira')).toBeTruthy()
})

test('toque e toque longo', async () => {
  const onPress = jest.fn()
  const onLongPress = jest.fn()
  await render(<BookCard book={book} coverUri={null} onPress={onPress} onLongPress={onLongPress} />)
  fireEvent.press(screen.getByLabelText('O Relógio Parado da Sala'))
  fireEvent(screen.getByLabelText('O Relógio Parado da Sala'), 'longPress')
  expect(onPress).toHaveBeenCalledTimes(1)
  expect(onLongPress).toHaveBeenCalledTimes(1)
})

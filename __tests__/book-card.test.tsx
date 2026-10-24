import { fireEvent, render, screen } from '@testing-library/react-native'
import { BookCard } from '@/components/BookCard'
import { PRESET_THEMES } from '@/lib/db/presets'
import { paletteFor } from '@/lib/palette'

const book = { id: 'a', title: 'O Relógio Parado da Sala', author: 'Joana Vieira' }
const palette = paletteFor(PRESET_THEMES[1])

test('sem capa mostra título e autora com as cores do tema', async () => {
  await render(
    <BookCard
      book={book}
      coverUri={null}
      percent={null}
      palette={palette}
      width={160}
      cloud={false}
      downloading={false}
      onPress={() => {}}
      onMenu={() => {}}
      onDownload={() => {}}
    />,
  )
  expect(screen.getAllByText('O Relógio Parado da Sala').length).toBeGreaterThan(0)
  expect(screen.getByText('Joana Vieira')).toHaveStyle({ color: palette.muted })
  expect(screen.queryByLabelText('Baixar')).toBeNull()
})

test('toque abre e o botão ⋮ chama o menu', async () => {
  const onPress = jest.fn()
  const onMenu = jest.fn()
  await render(
    <BookCard
      book={book}
      coverUri={null}
      percent={0.3}
      palette={palette}
      width={160}
      cloud={false}
      downloading={false}
      onPress={onPress}
      onMenu={onMenu}
      onDownload={() => {}}
    />,
  )
  await fireEvent.press(screen.getByLabelText('O Relógio Parado da Sala'))
  await fireEvent.press(screen.getByLabelText('Opções de O Relógio Parado da Sala'))
  expect(onPress).toHaveBeenCalledTimes(1)
  expect(onMenu).toHaveBeenCalledTimes(1)
})

test('livro só no Drive mostra o botão de baixar', async () => {
  const onDownload = jest.fn()
  const onPress = jest.fn()
  await render(
    <BookCard
      book={book}
      coverUri={null}
      percent={null}
      palette={palette}
      width={160}
      cloud
      downloading={false}
      onPress={onPress}
      onMenu={() => {}}
      onDownload={onDownload}
    />,
  )
  await fireEvent.press(screen.getByLabelText('Baixar'))
  expect(onDownload).toHaveBeenCalledTimes(1)
  expect(onPress).not.toHaveBeenCalled()
})

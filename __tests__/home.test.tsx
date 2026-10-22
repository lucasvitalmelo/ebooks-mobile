import { render, screen } from '@testing-library/react-native'
import Home from '@/app/index'

test('mostra o nome do app', async () => {
  await render(<Home />)
  expect(screen.getByText('E-books')).toBeTruthy()
})

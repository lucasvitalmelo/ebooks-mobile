import { brightnessLevels, DIM_BELOW } from './brightness'

test('acima do limite, só o brilho da janela', () => {
  expect(brightnessLevels(100)).toEqual({ window: 1, dim: 0 })
  expect(brightnessLevels(40)).toEqual({ window: 0.4, dim: 0 })
  expect(brightnessLevels(DIM_BELOW)).toEqual({ window: 0.1, dim: 0 })
})

test('abaixo do limite, a janela fica no mínimo e uma camada preta escurece o resto', () => {
  expect(brightnessLevels(5)).toEqual({ window: 0.02, dim: 0.25 })
  expect(brightnessLevels(0)).toEqual({ window: 0.02, dim: 0.5 })
  expect(brightnessLevels(-20)).toEqual({ window: 0.02, dim: 0.5 })
})

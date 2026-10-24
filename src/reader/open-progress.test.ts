import { OPEN_STAGES, openProgress, stageLabel } from './open-progress'

test('cada etapa preenche um pedaço do anel, em ordem', () => {
  expect(openProgress('download', 0)).toBe(0)
  expect(openProgress('download', 1)).toBeCloseTo(OPEN_STAGES.read.from)
  expect(openProgress('read', 1)).toBeCloseTo(OPEN_STAGES.transfer.from)
  expect(openProgress('transfer', 0.5)).toBeCloseTo((OPEN_STAGES.transfer.from + OPEN_STAGES.parse.from) / 2)
  expect(openProgress('render', 1)).toBe(1)
})

test('a fração fica entre 0 e 1', () => {
  expect(openProgress('transfer', 2)).toBeCloseTo(OPEN_STAGES.parse.from)
  expect(openProgress('transfer', -1)).toBeCloseTo(OPEN_STAGES.transfer.from)
})

test('o texto de cada etapa', () => {
  expect(stageLabel('download')).toBe('Baixando do Google Drive…')
  expect(stageLabel('render')).toBe('Montando as páginas…')
})

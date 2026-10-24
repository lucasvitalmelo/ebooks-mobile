import { fontScaleFor } from './font-scale'

describe('fontScaleFor', () => {
  it('compensa o texto que sai menor que o tamanho escolhido', () => {
    const samples = [
      { fontSize: 77.4, chars: 100_000 },
      { fontSize: 142, chars: 300 },
    ]
    expect(fontScaleFor(samples, 100)).toBe(1.299)
  })

  it('usa o tamanho com mais caracteres, não a média', () => {
    const samples = [
      { fontSize: 100, chars: 5_000 },
      { fontSize: 50, chars: 4_000 },
    ]
    expect(fontScaleFor(samples, 100)).toBe(1)
  })

  it('ignora diferença pequena', () => {
    expect(fontScaleFor([{ fontSize: 97, chars: 10 }], 100)).toBe(1)
  })

  it('não escala livro com fonte absoluta (fora de 0,5x–2x)', () => {
    expect(fontScaleFor([{ fontSize: 16, chars: 10 }], 100)).toBe(1)
  })

  it('devolve 1 sem amostras', () => {
    expect(fontScaleFor([], 100)).toBe(1)
  })
})

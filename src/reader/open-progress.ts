// A abertura de um livro em etapas reais, cada uma com a sua fatia do anel. O
// app mede as duas primeiras; a página do leitor avisa as outras (openProgress).
export type OpenStage = 'download' | 'read' | 'transfer' | 'parse' | 'render'
export type ReaderOpenStage = Extract<OpenStage, 'transfer' | 'parse' | 'render'>

export const OPEN_STAGES: Record<OpenStage, { from: number; to: number; label: string }> = {
  download: { from: 0, to: 0.25, label: 'Baixando do Google Drive…' },
  read: { from: 0.25, to: 0.3, label: 'Lendo o arquivo…' },
  // O livro vai para a página em pedaços de 512 KB: num livro grande é a etapa mais longa.
  transfer: { from: 0.3, to: 0.7, label: 'Preparando o livro…' },
  parse: { from: 0.7, to: 0.85, label: 'Abrindo o EPUB…' },
  render: { from: 0.85, to: 1, label: 'Montando as páginas…' },
}

export function openProgress(stage: OpenStage, fraction: number): number {
  const { from, to } = OPEN_STAGES[stage]
  return from + (to - from) * Math.min(1, Math.max(0, fraction))
}

export function stageLabel(stage: OpenStage): string {
  return OPEN_STAGES[stage].label
}

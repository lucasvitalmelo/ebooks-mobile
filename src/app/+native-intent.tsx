// Um arquivo aberto com o app ("Abrir com") chega como content:// e o Router
// tentaria tratá-lo como rota. O arquivo em si é lido pelo módulo share-intent.
// Com o app já aberto, null mantém a tela atual: quem está lendo não sai do livro.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (!/^(content|file):/.test(path)) return path
  return initial ? '/' : null
}

// Uma operação de cada vez sobre os arquivos da biblioteca (importar, editar,
// remover, limpar): sem isso, a limpeza em segundo plano poderia recriar um
// livro recém-removido ou sobrescrever uma edição.
let tail: Promise<unknown> = Promise.resolve()

export function withLibraryLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn)
  tail = run.catch(() => undefined)
  return run
}

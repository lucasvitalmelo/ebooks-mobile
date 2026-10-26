import { importBooks, type ImportDeps, type ImportSummary } from './import'
import type { SharedFile } from '../../modules/share-intent'

export async function importShared(deps: ImportDeps, files: SharedFile[]): Promise<ImportSummary> {
  const readable = files.flatMap((file) => (file.uri ? [{ uri: file.uri, name: file.name }] : []))
  const summary = await importBooks(deps, readable)
  for (const file of files) {
    if (!file.uri) summary.invalid.push({ name: file.name, reason: 'Não foi possível ler o arquivo' })
  }
  return summary
}

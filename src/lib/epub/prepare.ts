import JSZip from 'jszip'
import { repack } from './edit'
import { sanitizeCss } from './sanitize'

// Roda na importação, como o prepareEpub do leitor web: só as folhas de estilo
// mudam, nunca o HTML dos capítulos, então posições e grifos continuam valendo.
// Qualquer falha devolve o arquivo como veio.
export async function prepareEpub(bytes: Uint8Array): Promise<{ bytes: Uint8Array; changed: boolean }> {
  try {
    const zip = await JSZip.loadAsync(bytes)
    const changed = new Map<string, string | Uint8Array>()
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || !/\.css$/i.test(entry.name)) continue
      const original = await entry.async('string')
      const clean = sanitizeCss(original)
      if (clean !== original) changed.set(entry.name, clean)
    }
    if (changed.size === 0) return { bytes, changed: false }
    return { bytes: await repack(zip, changed), changed: true }
  } catch (error) {
    console.warn('Não foi possível limpar o EPUB; mantendo o arquivo original', error)
    return { bytes, changed: false }
  }
}

import JSZip from 'jszip/dist/jszip'
import { fontScaleFor, type FontSample } from '../../src/reader/font-scale'

const REFERENCE_PX = 100
// O tamanho predominante se firma com uma fração do livro; passar disso só gasta tempo e memória.
const MAX_SAMPLED_CHARS = 200_000
const FONT_FACE = /@font-face\s*\{[^}]*\}/gi
const IMPORT = /@import[^;]*;/gi

function resolvePath(fromFile: string, href: string): string {
  const parts = fromFile.split('/').slice(0, -1)
  for (const segment of decodeURIComponent(href.split('#')[0]).split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.' && segment !== '') parts.push(segment)
  }
  return parts.join('/')
}

function parseXml(text: string, type: DOMParserSupportedType): Document {
  return new DOMParser().parseFromString(text, type)
}

// Livros mandam "XHTML" que o parser XML recusa; o de HTML aceita qualquer coisa.
function parseChapter(source: string): Document {
  const xml = parseXml(source, 'application/xhtml+xml')
  if (!xml.getElementsByTagName('parsererror').length) return xml
  return parseXml(source, 'text/html')
}

// Como o prepareEpub do leitor web: cada capítulo é montado num iframe fora da
// tela com o CSS do livro e o corpo forçado a 100 px; o tamanho predominante do
// texto dá o fator que traz a letra do livro de volta ao tamanho do tema.
export async function measureFontScale(buffer: ArrayBuffer): Promise<number> {
  const zip = await JSZip.loadAsync(buffer)
  const container = await zip.file('META-INF/container.xml')?.async('string')
  const opfPath =
    container &&
    parseXml(container, 'application/xml').getElementsByTagNameNS('*', 'rootfile')[0]?.getAttribute('full-path')
  const opfText = opfPath ? await zip.file(opfPath)?.async('string') : undefined
  if (!opfPath || !opfText) return 1
  const opf = parseXml(opfText, 'application/xml')
  const hrefById = new Map(
    Array.from(opf.getElementsByTagNameNS('*', 'item')).map((item) => [
      item.getAttribute('id'),
      item.getAttribute('href'),
    ]),
  )
  const chapters = Array.from(opf.getElementsByTagNameNS('*', 'itemref'))
    .map((ref) => hrefById.get(ref.getAttribute('idref')))
    .filter((href): href is string => Boolean(href))
    .map((href) => resolvePath(opfPath, href))

  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-same-origin')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:600px;height:800px;visibility:hidden'
  document.body.appendChild(iframe)
  const samples: FontSample[] = []
  try {
    const target = iframe.contentDocument!
    const view = iframe.contentWindow!
    let sampled = 0
    for (const path of chapters) {
      if (sampled >= MAX_SAMPLED_CHARS) break
      // Devolve o controle à página entre capítulos: a medição não congela a tela.
      await new Promise((resolve) => setTimeout(resolve))
      const source = await zip.file(path)?.async('string')
      const doc = source ? parseChapter(source) : undefined
      if (!doc?.documentElement) continue
      const sheets: string[] = []
      for (const link of Array.from(doc.querySelectorAll('link'))) {
        if (!/stylesheet/i.test(link.getAttribute('rel') ?? '')) continue
        const css = await zip.file(resolvePath(path, link.getAttribute('href') ?? ''))?.async('string')
        if (css !== undefined) sheets.push(css.replace(FONT_FACE, '').replace(IMPORT, ''))
      }
      doc
        .querySelectorAll('link, script, img, image, video, audio, iframe, object, embed, source')
        .forEach((el) => el.remove())
      target.replaceChild(target.importNode(doc.documentElement, true), target.documentElement)
      for (const sheet of sheets) {
        const style = target.createElement('style')
        style.textContent = sheet
        ;(target.head ?? target.documentElement).appendChild(style)
      }
      if (!target.body) continue
      target.body.style.setProperty('font-size', `${REFERENCE_PX}px`, 'important')
      const walker = target.createTreeWalker(target.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const chars = node.textContent?.trim().length ?? 0
        if (!chars || !node.parentElement) continue
        samples.push({ fontSize: parseFloat(view.getComputedStyle(node.parentElement).fontSize), chars })
        sampled += chars
      }
    }
  } finally {
    iframe.remove()
  }
  return fontScaleFor(samples, REFERENCE_PX)
}

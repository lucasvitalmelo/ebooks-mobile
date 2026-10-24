import JSZip from 'jszip'
import type { Chapter } from '../pdf/layout'

export interface BuildInput {
  identifier: string
  title: string
  author: string
  language: string
  // Data fixa vinda de quem chama: o mesmo PDF precisa gerar o mesmo EPUB (e o mesmo ID de livro).
  modified: string
  chapters: Chapter[]
  cover: { bytes: Uint8Array; extension: 'jpg' | 'png' } | null
}

// O texto do PDF pode trazer caracteres que o XML 1.0 não admite (controle, U+FFFE/U+FFFF,
// substitutos soltos); o epub.js lê os capítulos como XML e recusaria o arquivo inteiro.
export function xmlSafe(text: string): string {
  const stripped = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  let out = ''
  for (let i = 0; i < stripped.length; i++) {
    const code = stripped.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = stripped.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += stripped[i] + stripped[i + 1]
        i++
      }
    } else if (code < 0xdc00 || code > 0xdfff) out += stripped[i]
  }
  return out
}

const escape = (text: string) =>
  xmlSafe(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function chapterXhtml(chapter: Chapter, language: string): string {
  const body = chapter.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${language}" lang="${language}">
<head><title>${escape(chapter.title)}</title></head>
<body>
<h1>${escape(chapter.title)}</h1>
${body}
</body>
</html>
`
}

// EPUB 3 mínimo e válido para texto corrido: o que a conversão do PDF produz.
export async function buildEpub(input: BuildInput): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`,
  )
  const files = input.chapters.map((chapter, i) => ({ id: `cap${i + 1}`, href: `cap${i + 1}.xhtml`, chapter }))
  for (const file of files) zip.file(`OEBPS/${file.href}`, chapterXhtml(file.chapter, input.language))
  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${input.language}">
<head><title>Sumário</title></head>
<body>
<nav epub:type="toc"><ol>
${files.map((f) => `<li><a href="${f.href}">${escape(f.chapter.title)}</a></li>`).join('\n')}
</ol></nav>
</body>
</html>
`,
  )
  const coverHref = input.cover ? `capa.${input.cover.extension}` : null
  if (input.cover && coverHref) zip.file(`OEBPS/${coverHref}`, input.cover.bytes, { compression: 'STORE' })
  const coverType = input.cover?.extension === 'png' ? 'image/png' : 'image/jpeg'
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId" xml:lang="${input.language}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escape(input.identifier)}</dc:identifier>
    <dc:title>${escape(input.title)}</dc:title>
    ${input.author ? `<dc:creator>${escape(input.author)}</dc:creator>` : ''}
    <dc:language>${input.language}</dc:language>
    <meta property="dcterms:modified">${escape(input.modified)}</meta>
    ${coverHref ? '<meta name="cover" content="cover-image"/>' : ''}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${coverHref ? `<item id="cover-image" href="${coverHref}" media-type="${coverType}" properties="cover-image"/>` : ''}
    ${files.map((f) => `<item id="${f.id}" href="${f.href}" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine>
    ${files.map((f) => `<itemref idref="${f.id}"/>`).join('\n    ')}
  </spine>
</package>
`,
  )
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

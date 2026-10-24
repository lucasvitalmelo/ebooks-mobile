import { XMLParser, XMLValidator } from 'fast-xml-parser'
import JSZip from 'jszip'

export class InvalidEpubError extends Error {}

export class ProtectedEpubError extends InvalidEpubError {
  constructor() {
    super('Livro protegido por DRM')
  }
}

export interface ParsedEpub {
  title: string
  author: string
  cover: { bytes: Uint8Array; extension: string } | null
}

type XmlNode = Record<string, unknown> & { '#text'?: string }

const ARRAYS = new Set(['title', 'creator', 'meta', 'item', 'rootfile', 'EncryptionMethod'])

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  htmlEntities: true,
  parseTagValue: false,
  alwaysCreateTextNode: true,
  isArray: (name) => ARRAYS.has(name),
})

// Ofuscação de fonte não é DRM: o texto continua legível.
const FONT_OBFUSCATION = new Set(['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC'])

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export const UNKNOWN_AUTHOR = 'Autor desconhecido'

export async function parseEpub(bytes: Uint8Array, fileName: string): Promise<ParsedEpub> {
  try {
    return await readEpub(bytes, fileName)
  } catch (error) {
    if (error instanceof InvalidEpubError) throw error
    throw new InvalidEpubError('EPUB corrompido')
  }
}

function parseXml(xml: string): Record<string, unknown> {
  if (XMLValidator.validate(xml) !== true) throw new InvalidEpubError('EPUB corrompido')
  return parser.parse(xml)
}

async function readEpub(bytes: Uint8Array, fileName: string): Promise<ParsedEpub> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(bytes)
  } catch {
    throw new InvalidEpubError('Não é um arquivo EPUB')
  }
  const mimetype = await zip.file('mimetype')?.async('string')
  if (mimetype !== undefined && mimetype.trim() !== 'application/epub+zip') {
    throw new InvalidEpubError('Não é um arquivo EPUB')
  }
  await assertNotProtected(zip)

  const containerXml = await zip.file('META-INF/container.xml')?.async('string')
  const rootfile = containerXml ? (findAll(parseXml(containerXml), 'rootfile')[0] as XmlNode | undefined) : undefined
  const opfPath = rootfile?.['@_full-path'] as string | undefined
  const opfXml = opfPath ? await zip.file(opfPath)?.async('string') : undefined
  if (!opfPath || !opfXml) throw new InvalidEpubError('EPUB sem documento de pacote (OPF)')

  const pkg = (parseXml(opfXml).package ?? {}) as XmlNode
  // Em EPUB 2 / OEB 1.2 os elementos podem vir dentro de <dc-metadata> e <x-metadata>.
  const metadata = (pkg.metadata ?? {}) as XmlNode
  const metas = findAll(metadata, 'meta') as XmlNode[]
  const items = ((pkg.manifest as XmlNode | undefined)?.item ?? []) as XmlNode[]

  const refinement = (element: XmlNode, property: string) =>
    metas
      .find((meta) => meta['@_refines'] === `#${element['@_id']}` && meta['@_property'] === property)
      ?.['#text']?.trim()

  const titles = findAll(metadata, 'title') as XmlNode[]
  const main = titles.find((title) => refinement(title, 'title-type') === 'main') ?? titles[0]
  const authors = (findAll(metadata, 'creator') as XmlNode[])
    .filter((creator) => {
      const role = (creator['@_role'] as string | undefined) || refinement(creator, 'role')
      return !role || role === 'aut'
    })
    .map((creator) => creator['#text']?.trim() ?? '')
    .filter(Boolean)

  return {
    title: main?.['#text']?.trim() || fileName.replace(/\.epub$/i, ''),
    author: authors.join(' & ') || UNKNOWN_AUTHOR,
    cover: await readCover(zip, opfPath, items, metas),
  }
}

async function assertNotProtected(zip: JSZip) {
  // rights.xml: licença da Adobe; sinf.xml: da Apple.
  if (zip.file('META-INF/rights.xml') || zip.file('META-INF/sinf.xml')) throw new ProtectedEpubError()
  const encryption = await zip.file('META-INF/encryption.xml')?.async('string')
  if (!encryption) return
  for (const method of findAll(parseXml(encryption), 'EncryptionMethod') as XmlNode[]) {
    if (!FONT_OBFUSCATION.has((method['@_Algorithm'] as string | undefined) ?? '')) throw new ProtectedEpubError()
  }
}

async function readCover(zip: JSZip, opfPath: string, items: XmlNode[], metas: XmlNode[]) {
  const coverId = metas.find((meta) => meta['@_name'] === 'cover')?.['@_content']
  const item =
    items.find((i) =>
      String(i['@_properties'] ?? '')
        .split(/\s+/)
        .includes('cover-image'),
    ) ?? items.find((i) => coverId !== undefined && (i['@_id'] === coverId || i['@_href'] === coverId))
  const href = (item?.['@_href'] as string | undefined)?.split('#')[0]
  if (!href) return null
  const path = resolvePath(opfPath, safeDecode(href))
  const bytes = await zip.file(path)?.async('uint8array')
  if (!bytes) return null
  const fromName = /\.([a-z0-9]+)$/i.exec(href)?.[1]?.toLowerCase()
  const extension =
    IMAGE_EXTENSIONS[String(item?.['@_media-type'])] ?? (fromName === 'jpeg' ? 'jpg' : fromName) ?? 'img'
  return { bytes, extension }
}

function safeDecode(href: string): string {
  try {
    return decodeURIComponent(href)
  } catch {
    return href
  }
}

function resolvePath(opfPath: string, href: string): string {
  const parts = opfPath.split('/').slice(0, -1)
  for (const segment of href.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.' && segment !== '') parts.push(segment)
  }
  return parts.join('/')
}

function findAll(node: unknown, name: string): unknown[] {
  if (!node || typeof node !== 'object') return []
  const found: unknown[] = []
  for (const [key, value] of Object.entries(node)) {
    if (key === name) found.push(...(Array.isArray(value) ? value : [value]))
    else found.push(...findAll(value, name))
  }
  return found
}

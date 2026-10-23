import ePub, { EpubCFI, type Book, type Contents, type Location, type Rendition } from 'epubjs'
import { classifyGesture, type Gesture } from '../../src/reader/gestures'
import { hitHighlight, type Rect } from '../../src/reader/hit'
import { resolveLink } from '../../src/reader/links'
import { Assembler, parseCommand, type Command, type HighlightRef, type ReaderEvent } from '../../src/reader/protocol'
import type { ReaderTheme } from '../../src/reader/theme'
import { themeCss } from '../../src/reader/theme-css'
import { flattenToc } from '../../src/reader/toc'
import fontsCss from './fonts.css?inline'

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(data: string): void }
    __rnReceive?: (chunk: unknown) => void
  }
}

const LOCATION_CHARS = 1024
// Uma fonte que não carrega não pode segurar o posicionamento para sempre.
const FONTS_TIMEOUT_MS = 3000
const SETTLE_MAX_ATTEMPTS = 3
const viewer = document.getElementById('viewer')!

let book: Book | null = null
let rendition: Rendition | null = null
let locationsReady = false
let theme: ReaderTheme | null = null
let canPage = false
// A posição que o leitor escolheu: a restaurada, a de um goTo ou a página para
// onde ele virou. Fontes que chegam depois (font-display: swap) e mudanças de
// tema refazem o layout e mudam onde a página começa sem o leitor sair dela;
// gravar esse novo começo a cada vez fazia a posição andar sozinha. Depois de
// cada relayout é este CFI que se reencontra, e só um movimento de verdade o troca.
let anchor: string | null = null
// Enquanto > 0 a tela está sendo reposicionada: os relocated não são do leitor.
let settling = 0
// id → cfiRange dos grifos do livro aberto. O epub.js guarda as anotações e as
// desenha em cada capítulo que abre; este mapa serve para acertar toques.
const highlights = new Map<string, string>()
let selectionSent = false
const HIGHLIGHT_STYLE = { fill: '#fac73c', 'fill-opacity': '0.45' }

function send(event: ReaderEvent) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(event))
}

function percentOf(cfi: string): number | null {
  return locationsReady && book ? book.locations.percentageFromCfi(cfi) : null
}

function sendPosition(cfi: string) {
  const location = rendition ? currentLocationOf(rendition) : undefined
  send({
    type: 'relocated',
    cfi,
    percent: percentOf(cfi),
    href: location?.start?.href ?? null,
    startCfi: location?.start?.cfi ?? null,
    endCfi: location?.end?.cfi ?? null,
  })
}

function withTimeout(promise: Promise<unknown>, ms: number): Promise<unknown> {
  return Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))])
}

function nextFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (remaining: number) => (remaining === 0 ? resolve() : requestAnimationFrame(() => step(remaining - 1)))
    step(count)
  })
}

function nextRelocation(r: Rendition, timeoutMs = 1000): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      r.off('relocated', done)
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    r.on('relocated', done)
  })
}

// Os .d.ts dizem que getContents devolve um só; em runtime é a lista.
function contentsOf(r: Rendition): Contents[] {
  return r.getContents() as unknown as Contents[]
}

// resizeCheck é privado nos .d.ts; remede o capítulo e reexpande a view.
function resizeCheck(contents: Contents) {
  ;(contents as unknown as { resizeCheck(): void }).resizeCheck()
}

// Sem width/height (que os .d.ts exigem) o epub.js remede o contêiner; só relayouta se o tamanho mudou.
function remeasure(r: Rendition) {
  ;(r as unknown as { resize(): void }).resize()
}

function waitForFonts(r: Rendition): Promise<unknown> {
  return withTimeout(
    Promise.all(
      contentsOf(r).map(({ document: doc }) => {
        // Força um layout para as fontes em uso serem pedidas; senão fonts.ready
        // pode resolver antes de alguma começar a carregar.
        void doc?.body?.offsetHeight
        return doc?.fonts?.ready
      }),
    ),
    FONTS_TIMEOUT_MS,
  )
}

// Calculada na hora: depois de um relayout a tela pode não ser mais a última posição que o epub.js avisou.
function currentLocationOf(r: Rendition): Location | undefined {
  try {
    return r.currentLocation() as unknown as Location | undefined
  } catch {
    return undefined
  }
}

function locationContains(location: Location | undefined, cfi: string): boolean {
  if (!location?.start?.cfi || !location.end?.cfi) return false
  const epubCfi = new EpubCFI()
  return epubCfi.compare(cfi, location.start.cfi) >= 0 && epubCfi.compare(cfi, location.end.cfi) <= 0
}

// Um relayout que muda a largura da página mantém o scroll antigo, que cai no
// meio de uma página; lê o manager do epub.js, que os .d.ts não expõem.
function isPageAligned(r: Rendition): boolean {
  const manager = (r as unknown as { manager?: { container?: HTMLElement; layout?: { delta: number } } }).manager
  const delta = manager?.layout?.delta
  if (!manager?.container || !delta) return true
  const offset = Math.abs(manager.container.scrollLeft) % delta
  return Math.min(offset, delta - offset) <= 1
}

// O epub.js escolhe a página do alvo assim que o iframe existe, mas tema e fontes
// chegam depois e refazem o layout sob um scroll fixo. Espera o estilo assentar e
// mostra o alvo de novo se ele saiu da tela (mesma lógica do leitor web).
async function settleAt(r: Rendition, target: string): Promise<void> {
  for (let attempt = 0; attempt < SETTLE_MAX_ATTEMPTS; attempt++) {
    await waitForFonts(r)
    await nextFrames(3)
    if (!r.book) return
    if (locationContains(currentLocationOf(r), target) && isPageAligned(r)) return
    const relocated = nextRelocation(r)
    await r.display(target)
    await relocated
  }
}

// Reencontra a âncora depois de um relayout, uma passada por vez: um pedido no
// meio de uma passada vira uma passada a mais, não um display() concorrente.
let resettleRunning = false
let resettlePending = false
function resettle() {
  const r = rendition
  if (!r || !canPage) return
  if (resettleRunning) {
    resettlePending = true
    return
  }
  resettleRunning = true
  settling++
  void (async () => {
    try {
      do {
        resettlePending = false
        const target = anchor ?? r.location?.start?.cfi
        if (target) await settleAt(r, target).catch(console.error)
      } while (resettlePending && r.book)
    } finally {
      resettleRunning = false
      settling--
    }
  })()
}

// Num <style> próprio, trocado inteiro: themes.default(regras) do epub.js acrescenta
// regras ao mesmo <style> a cada mudança, e um tema só com CSS (registerCss) não
// é injetado nos capítulos que abrem depois.
function injectTheme(contents: Contents) {
  if (theme) contents.addStylesheetCss(themeCss(theme), 'reader-theme')
}

function applyTheme(t: ReaderTheme) {
  document.body.style.background = t.background
  viewer.style.left = `${t.margin}px`
  viewer.style.right = `${t.margin}px`
  const r = rendition
  if (!r) return
  contentsOf(r).forEach(injectTheme)
  r.themes.fontSize(`${t.fontSize}px`)
  if (!canPage) return
  // O manager só relayouta quando o contêiner muda de tamanho (a margem); fonte,
  // tamanho e entrelinha mudam só o texto, que resizeCheck remede em cada capítulo.
  remeasure(r)
  contentsOf(r).forEach(resizeCheck)
  resettle()
}

function act(gesture: Gesture) {
  if (gesture === 'centerTap') send({ type: 'centerTap' })
  else if (gesture && canPage) void (gesture === 'next' ? rendition?.next() : rendition?.prev())
}

// offsetX leva a posição do toque para a tela: no iframe do capítulo, clientX é
// relativo a ele, que no modo paginado é bem mais largo que a tela e fica deslocado.
// hitTest: qual grifo está sob o toque (só nos capítulos; na margem não há grifo).
function registerGestures(
  doc: Document,
  offsetX: () => number,
  hitTest?: (x: number, y: number) => { id: string; rect: Rect } | null,
) {
  let start: { x: number; y: number; time: number; hadSelection: boolean } | null = null
  doc.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.touches[0]
      start =
        event.touches.length === 1
          ? {
              x: touch.clientX,
              y: touch.clientY,
              time: Date.now(),
              hadSelection: selectionSent || !(doc.getSelection()?.isCollapsed ?? true),
            }
          : null
    },
    { passive: true },
  )
  doc.addEventListener('touchend', (event) => {
    const touch = event.changedTouches[0]
    const from = start
    start = null
    if (!from || !touch) return
    // Com seleção na tela, o toque só a desfaz (o sistema já cuida disso).
    if (from.hadSelection) return
    if ((event.target as Element | null)?.closest?.('a')) return
    const move = {
      dx: touch.clientX - from.x,
      dy: touch.clientY - from.y,
      width: window.innerWidth,
      duration: Date.now() - from.time,
    }
    const gesture = classifyGesture({ ...move, x: offsetX() + touch.clientX })
    // Toque nas bordas também vira página; reclassificado no centro, só um toque
    // de verdade (nem arrasto nem toque longo) acerta o grifo, em qualquer lugar da tela.
    if (classifyGesture({ ...move, x: window.innerWidth / 2 }) === 'centerTap') {
      const hit = hitTest?.(touch.clientX, touch.clientY)
      if (hit) return send({ type: 'highlightTap', id: hit.id, rect: hit.rect })
    }
    act(gesture)
  })
}

// O iframe do epub.js não tem allow-scripts: nele o Chromium não roda nenhum onclick
// (nem o do epub.js, que seguia os links internos), mas roda listeners. Cancelar a
// navegação padrão evita o iframe sair do livro.
function handleLinks(doc: Document, contents: Contents, opened: Book) {
  doc.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!link) return
    event.preventDefault()
    const sectionPath =
      opened.spine.get(contents.sectionIndex)?.url ?? doc.querySelector('base')?.getAttribute('href') ?? ''
    const target = resolveLink(link.getAttribute('href') ?? '', sectionPath)
    if (!target) return
    if (target.kind === 'external') send({ type: 'openExternal', url: target.url })
    else {
      send({ type: 'linkJump' })
      void goTo(opened.path.relative(target.path) + target.hash)
    }
  })
}

// Os grifos deste capítulo com os retângulos na tela do iframe (mesmas coordenadas do toque).
function highlightsIn(contents: Contents) {
  const items: { id: string; rects: DOMRect[] }[] = []
  for (const [id, cfiRange] of highlights) {
    try {
      if (new EpubCFI(cfiRange).spinePos !== contents.sectionIndex) continue
      items.push({ id, rects: Array.from(contents.range(cfiRange).getClientRects()) })
    } catch {
      // CFI que não resolve neste capítulo: só não dá para tocar nele.
    }
  }
  return items
}

// Retângulo de um trecho na tela da WebView: o do Range é relativo ao iframe do
// capítulo, que no modo paginado é bem mais largo que a tela e fica deslocado.
function viewportRect(contents: Contents, cfiRange: string) {
  const range = contents.range(cfiRange).getBoundingClientRect()
  const frame = (contents.document.defaultView?.frameElement as HTMLElement | null)?.getBoundingClientRect()
  const dx = frame?.left ?? 0
  const dy = frame?.top ?? 0
  return { left: range.left + dx, top: range.top + dy, right: range.right + dx, bottom: range.bottom + dy }
}

function watchSelection(doc: Document) {
  doc.addEventListener('selectionchange', () => {
    if (!selectionSent || !(doc.getSelection()?.isCollapsed ?? true)) return
    selectionSent = false
    send({ type: 'selection', cfiRange: null, text: '', rect: null })
  })
}

function drawHighlight(r: Rendition, id: string, cfiRange: string) {
  highlights.set(id, cfiRange)
  r.annotations.highlight(cfiRange, { id }, () => {}, 'ebooks-highlight', HIGHLIGHT_STYLE)
}

function clearSelection() {
  if (rendition) for (const contents of contentsOf(rendition)) contents.window?.getSelection()?.removeAllRanges()
  if (selectionSent) {
    selectionSent = false
    send({ type: 'selection', cfiRange: null, text: '', rect: null })
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// Num segundo Book: gerar no mesmo que renderiza derruba o epub.js.
async function generateLocations(target: Book, buffer: ArrayBuffer) {
  const locationsBook = ePub(buffer.slice(0))
  await locationsBook.ready
  await locationsBook.locations.generate(LOCATION_CHARS)
  const data = locationsBook.locations.save()
  locationsBook.destroy()
  if (book !== target) return
  target.locations.load(data)
  locationsReady = true
  send({ type: 'locations', data })
  if (anchor) sendPosition(anchor)
}

async function open(base64: string, cfi: string | null, savedLocations: string | null, refs: HighlightRef[]) {
  book?.destroy()
  book = null
  rendition = null
  canPage = false
  locationsReady = false
  anchor = cfi
  highlights.clear()
  selectionSent = false
  const buffer = base64ToArrayBuffer(base64)
  const opened = ePub(buffer)
  book = opened
  try {
    // Um arquivo que não é EPUB nunca resolve book.ready; o epub.js só avisa por este evento.
    await new Promise<void>((resolve, reject) => {
      opened.on('openFailed', reject)
      opened.ready.then(() => resolve(), reject)
    })
  } catch (error) {
    console.error(error)
    throw new Error('o arquivo não é um EPUB válido.')
  }
  if (book !== opened) return
  if (savedLocations) {
    try {
      opened.locations.load(savedLocations)
      locationsReady = true
    } catch (error) {
      console.error('Locations salvas inválidas; gerando de novo', error)
    }
  }

  const current = opened.renderTo(viewer, { width: '100%', height: '100%', flow: 'paginated', spread: 'none' })
  rendition = current
  current.hooks.content.register((contents: Contents) => {
    const doc = contents.document
    contents.addStylesheetCss(fontsCss, 'reader-fonts')
    injectTheme(contents)
    handleLinks(doc, contents, opened)
    watchSelection(doc)
    registerGestures(
      doc,
      () => (doc.defaultView?.frameElement as HTMLElement | null)?.getBoundingClientRect().left ?? 0,
      (x, y) => {
        const id = hitHighlight(x, y, highlightsIn(contents))
        const cfiRange = id ? highlights.get(id) : undefined
        return id && cfiRange ? { id, rect: viewportRect(contents, cfiRange) } : null
      },
    )
    // Fonte que chega depois do layout muda o número de páginas, e o epub.js
    // 0.3.93 não percebe: resizeCheck remede e a âncora é reencontrada, mas só se
    // ela está neste capítulo. Num capítulo novo (virou a página para ele, seguiu um
    // link) a âncora ainda é a do anterior até o relocated chegar, e reencontrá-la
    // puxaria o leitor de volta.
    const refit = () => {
      if (!current.book) return
      resizeCheck(contents)
      if (anchor && new EpubCFI(anchor).spinePos === contents.sectionIndex) resettle()
    }
    doc.fonts?.forEach((face) => {
      face.loaded.then(refit, () => {})
    })
  })
  current.on('relocated', (location: Location) => {
    if (settling > 0 || !canPage) return
    // Ainda na página da âncora: o relayout mudou só onde ela começa.
    if (anchor && locationContains(location, anchor)) return
    anchor = location.start.cfi
    sendPosition(anchor)
  })
  current.on('resized', resettle)
  current.on('selected', (cfiRange: string, contents: Contents) => {
    selectionSent = true
    send({
      type: 'selection',
      cfiRange,
      text: contents.range(cfiRange).toString(),
      rect: viewportRect(contents, cfiRange),
    })
  })
  for (const { id, cfiRange } of refs) drawHighlight(current, id, cfiRange)
  if (theme) applyTheme(theme)

  settling++
  try {
    try {
      await current.display(cfi ?? undefined)
    } catch (error) {
      if (!cfi) throw error
      console.error('Posição salva inválida; abrindo do começo', error)
      anchor = null
      await current.display()
    }
    if (anchor) await settleAt(current, anchor).catch(console.error)
    else {
      await waitForFonts(current)
      await nextFrames(3)
    }
  } finally {
    settling--
  }
  if (rendition !== current) return
  canPage = true
  anchor ??= currentLocationOf(current)?.start?.cfi ?? null
  if (anchor) sendPosition(anchor)
  opened.loaded.navigation
    .then((navigation) => send({ type: 'toc', entries: flattenToc(navigation.toc) }))
    .catch((error: unknown) => {
      console.error('Sumário ilegível', error)
      send({ type: 'toc', entries: [] })
    })
  if (!locationsReady) generateLocations(opened, buffer).catch(console.error)
}

async function goTo(target: string) {
  const r = rendition
  if (!r || !canPage) return send({ type: 'jumpEnded', ok: false })
  const isCfi = target.startsWith('epubcfi(')
  anchor = isCfi ? target : null
  settling++
  try {
    await r.display(target)
    if (isCfi) await settleAt(r, target)
    else {
      await waitForFonts(r)
      await nextFrames(3)
      anchor = currentLocationOf(r)?.start?.cfi ?? null
    }
  } catch (error) {
    console.error('Salto falhou', error)
    return send({ type: 'jumpEnded', ok: false })
  } finally {
    settling--
  }
  if (anchor) sendPosition(anchor)
  send({ type: 'jumpEnded', ok: true })
}

async function handle(command: Command) {
  switch (command.type) {
    case 'open':
      return open(command.base64, command.cfi, command.locations, command.highlights)
    case 'next':
      return canPage ? rendition?.next() : undefined
    case 'prev':
      return canPage ? rendition?.prev() : undefined
    case 'goTo':
      return goTo(command.target)
    case 'setTheme':
      theme = command.theme
      return applyTheme(theme)
    case 'addHighlight':
      if (rendition) drawHighlight(rendition, command.id, command.cfiRange)
      return clearSelection()
    case 'removeHighlight': {
      const cfiRange = highlights.get(command.id)
      highlights.delete(command.id)
      if (cfiRange) rendition?.annotations.remove(cfiRange, 'highlight')
      return
    }
    case 'clearSelection':
      return clearSelection()
  }
}

// Toques nas margens do #viewer, fora do iframe do capítulo, também viram página.
registerGestures(document, () => 0)

const assembler = new Assembler()
window.__rnReceive = (chunk) => {
  const raw = assembler.push(chunk)
  if (raw === null) return
  const command = parseCommand(raw)
  if (!command) return
  // Só falhar ao abrir vira erro na tela; o resto fica no console.
  handle(command).catch((error: unknown) => {
    if (command.type !== 'open') return console.error(error)
    send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  })
}

send({ type: 'ready' })

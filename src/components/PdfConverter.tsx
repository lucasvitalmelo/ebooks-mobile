import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import type { PageText } from '@/lib/pdf/layout'
import { PDF_HTML } from '@/pdf/bundle.generated'
import { parsePdfEvent, type PdfResult } from '@/pdf/protocol'
import { chunkMessage } from '@/reader/protocol'

export interface PdfConverterHandle {
  convert(base64: string, onProgress: (page: number, total: number) => void): Promise<PdfResult>
}

interface Pending {
  resolve(result: PdfResult): void
  reject(error: Error): void
  onProgress(page: number, total: number): void
  pages: PageText[]
  timer: ReturnType<typeof setTimeout> | null
}

const READY_TIMEOUT = 30_000
const IDLE_TIMEOUT = 60_000
const FAILURE = 'Não foi possível converter o PDF'

function makeGate() {
  let open: () => void = () => {}
  const ready = new Promise<void>((resolve) => (open = resolve))
  return { ready, open }
}

// WebView escondida com o pdf.js: só existe para ler PDFs na importação.
export function PdfConverter({ ref }: { ref: Ref<PdfConverterHandle> }) {
  const webview = useRef<WebView<object>>(null)
  const gate = useRef(makeGate())
  const pending = useRef(new Map<number, Pending>())
  const nextId = useRef(1)
  // Trocar a key remonta a WebView: é o jeito de recomeçar depois que o processo dela morre ou trava.
  const [generation, setGeneration] = useState(0)

  const finish = (id: number) => {
    const job = pending.current.get(id)
    if (job?.timer) clearTimeout(job.timer)
    pending.current.delete(id)
    return job
  }

  const restart = () => {
    for (const id of [...pending.current.keys()]) finish(id)?.reject(new Error(FAILURE))
    gate.current = makeGate()
    setGeneration((g) => g + 1)
  }

  // Sem sinal de vida por um tempo, a conversão é dada como perdida e a WebView recomeça.
  const arm = (id: number) => {
    const job = pending.current.get(id)
    if (!job) return
    if (job.timer) clearTimeout(job.timer)
    job.timer = setTimeout(restart, IDLE_TIMEOUT)
  }

  useImperativeHandle(
    ref,
    () => ({
      async convert(base64, onProgress) {
        const current = gate.current
        let readyTimer: ReturnType<typeof setTimeout> | undefined
        try {
          await Promise.race([
            current.ready,
            new Promise<never>((_, reject) => {
              readyTimer = setTimeout(() => {
                restart()
                reject(new Error(FAILURE))
              }, READY_TIMEOUT)
            }),
          ])
        } finally {
          clearTimeout(readyTimer)
        }
        const id = nextId.current++
        const result = new Promise<PdfResult>((resolve, reject) => {
          pending.current.set(id, { resolve, reject, onProgress, pages: [], timer: null })
          arm(id)
        })
        for (const chunk of chunkMessage(JSON.stringify({ type: 'convert', id, base64 }))) {
          webview.current?.injectJavaScript(`window.__rnReceive && window.__rnReceive(${JSON.stringify(chunk)}); true;`)
        }
        return result
      },
    }),
    // restart e arm só usam refs e o setter de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <WebView<object>
      key={generation}
      ref={webview}
      source={{ html: PDF_HTML }}
      originWhitelist={['*']}
      style={styles.hidden}
      onRenderProcessGone={restart}
      onContentProcessDidTerminate={restart}
      onMessage={(event) => {
        const parsed = parsePdfEvent(event.nativeEvent.data)
        if (!parsed) return
        if (parsed.type === 'ready') return gate.current.open()
        const job = pending.current.get(parsed.id)
        if (!job) return
        arm(parsed.id)
        if (parsed.type === 'progress') return job.onProgress(parsed.page, parsed.total)
        if (parsed.type === 'pageText') {
          job.pages[parsed.index] = { lines: parsed.lines }
          return
        }
        finish(parsed.id)
        if (parsed.type === 'pdfError') return job.reject(new Error(parsed.message))
        job.resolve({
          title: parsed.title,
          author: parsed.author,
          modified: parsed.modified,
          pages: Array.from({ length: parsed.pageCount }, (_, i) => job.pages[i] ?? { lines: [] }),
          outline: parsed.outline,
          cover: parsed.cover,
        })
      }}
    />
  )
}

// Um tamanho mínimo e invisível: com 0×0 o Android pode não montar a WebView.
const styles = StyleSheet.create({ hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 } })

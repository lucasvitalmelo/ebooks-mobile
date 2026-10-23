import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import { READER_HTML } from '@/reader/bundle.generated'
import { chunkMessage, parseEvent, type Command, type ReaderEvent } from '@/reader/protocol'

export interface ReaderHandle {
  send(command: Command): void
}

interface Props {
  ref: Ref<ReaderHandle>
  background: string
  onEvent(event: ReaderEvent): void | Promise<void>
}

export function Reader({ ref, background, onEvent }: Props) {
  const webview = useRef<WebView<object>>(null)
  // Trocar a key monta uma WebView nova; a página nova manda ready e a tela reabre o livro.
  const [generation, setGeneration] = useState(0)

  useImperativeHandle(
    ref,
    () => ({
      send(command) {
        for (const chunk of chunkMessage(JSON.stringify(command))) {
          // Antes da página carregar __rnReceive ainda não existe; o app só
          // manda o livro depois do evento ready.
          webview.current?.injectJavaScript(`window.__rnReceive && window.__rnReceive(${JSON.stringify(chunk)}); true;`)
        }
      },
    }),
    [],
  )

  return (
    // Sem o argumento de tipo, o P padrão (undefined) faz as props do WebView virarem never.
    <WebView<object>
      key={generation}
      ref={webview}
      source={{ html: READER_HTML }}
      originWhitelist={['*']}
      // Sem itens, o Android não abre o menu da seleção; Copiar e Grifar ficam no cartão de seleção.
      menuItems={[]}
      style={[styles.webview, { backgroundColor: background }]}
      onMessage={(event) => {
        const parsed = parseEvent(event.nativeEvent.data)
        if (!parsed) return console.warn('Mensagem inválida do leitor', event.nativeEvent.data.slice(0, 200))
        Promise.resolve()
          .then(() => onEvent(parsed))
          .catch((error: unknown) => console.error('Erro ao tratar evento do leitor', parsed.type, error))
      }}
      // O Android mata o processo da WebView sob pouca memória (livro grande); sem isto a tela fica em branco.
      onRenderProcessGone={(event) => {
        console.error('Processo da WebView do leitor morreu', event.nativeEvent)
        setGeneration((value) => value + 1)
      }}
    />
  )
}

const styles = StyleSheet.create({ webview: { flex: 1 } })

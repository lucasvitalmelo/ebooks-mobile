import { readFileSync, writeFileSync } from 'node:fs'

const FONT_FILES = 16

// O CSS do @fontsource traz um .woff de reserva depois de cada .woff2. A WebView
// do Android lê woff2, então o .woff só pesaria (e iria para cada capítulo).
const html = readFileSync('reader-web/dist/index.html', 'utf8').replace(
  /,url\(data:font\/woff;base64,[A-Za-z0-9+/=]*\)format\("woff"\)/g,
  '',
)

const count = (text) => html.split(text).length - 1
if (count('data:font/woff2') !== FONT_FILES) {
  throw new Error(`Esperava ${FONT_FILES} fontes woff2 embutidas no leitor, achei ${count('data:font/woff2')}`)
}
if (count('data:font/woff;') !== 0) throw new Error('Sobraram fontes .woff no bundle do leitor')

writeFileSync(
  'src/reader/bundle.generated.ts',
  `// Gerado por npm run reader:build a partir de reader-web/. Não editar.\nexport const READER_HTML = ${JSON.stringify(html)}\n`,
)
console.log(`bundle do leitor: ${Math.round(html.length / 1024)} KB`)

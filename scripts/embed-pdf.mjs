import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('pdf-web/dist/index.html', 'utf8')
if (!html.includes('getDocument')) throw new Error('O pdf.js não entrou no bundle do PDF')
writeFileSync(
  'src/pdf/bundle.generated.ts',
  `// Gerado por npm run pdf:build a partir de pdf-web/. Não editar.\nexport const PDF_HTML = ${JSON.stringify(html)}\n`,
)
console.log(`bundle do PDF: ${Math.round(html.length / 1024)} KB`)

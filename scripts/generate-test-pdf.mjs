import { writeFileSync } from 'node:fs'
import { PDFDocument, StandardFonts } from 'pdf-lib'

// PDF de teste da conversão: 3 páginas com cabeçalho repetido, número de página,
// dois parágrafos por página e uma palavra hifenizada entre linhas.
const doc = await PDFDocument.create({ updateMetadata: false })
doc.setTitle('O Relógio em PDF')
doc.setAuthor('Joana Vieira')
const font = await doc.embedFont(StandardFonts.Helvetica)
for (let n = 1; n <= 3; n++) {
  const page = doc.addPage([400, 600])
  const write = (text, y) => page.drawText(text, { x: 40, y, size: 12, font })
  write('O Relogio em PDF', 570)
  write(`Comeco do capitulo ${n}, com uma pala-`, 520)
  write('vra quebrada no fim da linha.', 505)
  write(`Segundo paragrafo da pagina ${n}.`, 470)
  write(String(n), 30)
}
writeFileSync('fixtures/livro-de-teste.pdf', await doc.save({ useObjectStreams: false }))
console.log('fixtures/livro-de-teste.pdf gerado')

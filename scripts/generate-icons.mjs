// Gera os PNGs do ícone a partir de assets/icon.svg. Rodar de novo só quando o SVG mudar.
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const BACKGROUND = '#1a1a1f'
const svg = readFileSync('assets/icon.svg', 'utf8')
const book = svg.match(/<g id="livro">([\s\S]*?)<\/g>/)[1]
// Centro do livro no SVG de 160: (80, 79).
const placed = (scale) => `<g transform="translate(512 512) scale(${scale}) translate(-80 -79)">${book}</g>`

// Silhueta para os ícones temáticos do Android: só o alfa conta. A capa fica
// meio transparente e as linhas e a borda da folha que vira são recortadas.
// A máscara segue a ordem de pintura: a folha que vira repinta de branco o que
// está embaixo dela, senão as linhas da página da direita vazariam por ela.
const LEAF = 'M80 52 C90 36 104 26 120 26 C112 50 110 84 114 108 C102 108 90 114 80 124 Z'
const mask = `
  <mask id="recorte" maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="160">
    <rect width="160" height="160" fill="white"/>
    ${[...book.matchAll(/<path d="([^"]+)" fill="([^"]+)"[^>]*>/g)]
      .map(([, d, fill]) =>
        fill === 'none'
          ? `<path d="${d}" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>`
          : d === LEAF
            ? `<path d="${d}" fill="white"/><path d="${d}" fill="none" stroke="black" stroke-width="3"/>`
            : '',
      )
      .join('')}
  </mask>`
const silhouette = book
  .replace(/<path d="[^"]+" fill="none"[^>]*\/>/g, '')
  .replace(/fill="#e0703a"/, 'fill="white" fill-opacity="0.5"')
  .replace(/fill="#[0-9a-f]{6}"/g, 'fill="white"')

function png(name, body) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`
  writeFileSync(`assets/${name}`, new Resvg(doc, { fitTo: { mode: 'width', value: 1024 } }).render().asPng())
  console.log(`assets/${name}`)
}

// Ícone legado e da loja: quadrado cheio, o launcher arredonda.
png('icon.png', `<rect width="1024" height="1024" fill="${BACKGROUND}"/>${placed(5.4)}`)
// Adaptativo: o livro cabe no círculo seguro de 66/108 do quadro, uns 313 px de
// raio (a cor de fundo vem do app.json). Em 3.9 os cantos da capa ficam a ~305 px.
png('android-icon-foreground.png', placed(3.9))
png(
  'android-icon-monochrome.png',
  `<defs>${mask}</defs><g transform="translate(512 512) scale(3.9) translate(-80 -79)"><g mask="url(#recorte)">${silhouette}</g></g>`,
)

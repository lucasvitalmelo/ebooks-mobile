# Arquitetura

Spec do MVP: [superpowers/specs/2026-10-22-mvp-design.md](superpowers/specs/2026-10-22-mvp-design.md).

## Visão geral

App Expo com Expo Router. Duas telas no MVP: Biblioteca (`src/app/index.tsx`) e Leitor (`src/app/book/[id].tsx`). O livro é renderizado pelo epub.js dentro de uma WebView — o epub.js depende do DOM, então não há como renderizar EPUB nativamente sem reescrever um motor de layout. Todo o resto (arquivos, banco, navegação) é nativo.

## Fronteiras

- `src/lib/db/`: SQLite atrás de uma interface `Db` pequena; no app, `expo-sqlite`; nos testes, `node:sqlite`.
- `src/reader/protocol.ts`: única via entre RN e a WebView (comandos `open`, `next`, `prev`, `goTo`, `setTheme`; eventos `ready`, `relocated`, `locations`, `centerTap`, `openExternal`, `error`). `locations` leva as locations geradas, para o app guardar no banco; `centerTap` é o toque no centro da página, que mostra ou esconde a barra; `openExternal` é um link `http(s)`/`mailto` tocado no livro, que o app abre fora (os links internos ficam com o epub.js).
- `reader-web/`: app web mínimo com epub.js compilado num único HTML embutido no app.

## Decisões

- **React Native com Expo** em vez de Capacitor: o objetivo é aprender mobile, e o Capacitor só empacotaria o app web. Expo também compila na nuvem (EAS), o que permite iOS no futuro sem Mac.
- **Jest em vez de Vitest**: Vitest não suporta bem o ecossistema RN; `jest-expo` é o padrão.
- **release-please com merge commit**: o changelog sai por commit (link para o hash), não por PR — o número do PR só entra automaticamente com squash, que não usamos. Aceito.
- **Proteção de branches por ruleset** em `main` e `develop`: PR obrigatório (0 aprovações, projeto de uma pessoa), check `check` obrigatório, só merge commit, sem force push nem exclusão. Ruleset em vez da proteção clássica porque deixa o admin passar por cima das regras **só dentro de um PR** (bypass `pull_request`); a proteção clássica com `enforce_admins: false` liberaria também o push direto.
- **PR de release mergeado por admin dentro do PR**: PRs abertos pelo `GITHUB_TOKEN` não disparam o CI, então o check obrigatório nunca rodaria nele; o bypass do ruleset permite o merge sem abrir mão da recusa a push direto.
- **Build do APK no mesmo workflow do release-please**: a Release criada pelo `GITHUB_TOKEN` não dispara outro workflow.
- **`versionCode` remoto no EAS**: evita commitar contador de build; a versão visível vem do release-please.
- **Dependabot ignora os pacotes do SDK do Expo** (expo, react, react-native, typescript, eslint, jest e relacionados) e saltos major nos demais: esses pacotes precisam das versões que o SDK fixa, e atualizados sozinhos quebram o lint e o `expo-doctor` (#7). Sobem juntos, à mão, com `npx expo install --fix` na troca de SDK.
- **`node:sqlite` nos testes**: embutido no Node 24, sem binário nativo para compilar no Windows nem no CI. Os tipos vêm de um `declare module` mínimo em `src/test/node-modules.d.ts`, porque o `@types/node` inteiro conflitaria com os tipos de timer do RN.
- **Caminhos relativos ao documentDirectory**: o banco guarda `books/<id>.epub` e `covers/<id>.<ext>`, não o caminho absoluto, porque o absoluto pode mudar entre versões do app no iOS e o registro apontaria para um arquivo que não existe mais.
- **Seletor com filtro `*/*`**: no Android vários provedores (Drive, gerenciadores de arquivos) informam EPUB como `application/octet-stream`, e um filtro por tipo esconderia o arquivo. A validação fica por conta do parser, que recusa o que não é EPUB.
- **Livro em pedaços para a WebView**: o base64 vai em pedaços de 512 KB por `injectJavaScript`, remontados na página (`Assembler`). Uma chamada única com um livro de vários MB fica lenta ou falha.
- **Locations num segundo `Book`**: gerar as locations no mesmo `Book` que renderiza derruba o epub.js (mesmo achado do leitor web). Geradas uma vez por livro e guardadas em `books.locations`.
- **Bundle do leitor no `postinstall`**: roda no `npm ci` do CI e no `npm install` do EAS, sem hook próprio. Mexeu em `reader-web/`, rodar `npm run reader:build`.
- **Posição ancorada no leitor web**: a página guarda um CFI âncora (o restaurado, o de um `goTo` ou o da página para onde se virou) e, depois de cada relayout (fontes que chegam com `font-display: swap`, mudança de tema), espera as fontes e reexibe a âncora; `relocated` só vai para o app quando a página na tela já não contém a âncora. Sem isso, cada relayout gravava o novo começo da página e a posição andava sozinha a cada abertura. Mesma lógica do leitor web (`settleAt`/`persistIfMoved`).
- **Só `woff2` no bundle**: o CSS do `@fontsource` traz um `.woff` de reserva para cada fonte; a WebView do Android lê `woff2`, então o `embed-reader.mjs` tira os `.woff` (cerca de 580 KB de base64 que iriam para cada capítulo).
- **`@xmldom/xmldom` vulnerável via epub.js**: o `npm audit` acusa vulnerabilidade alta no `xmldom` que o epub.js 0.3.93 traz. É a mesma escolha do leitor web: a única versão mais nova (0.4.2) depende de um `xmldom` com vulnerabilidade crítica, e nenhuma versão estável está livre do problema. Aqui o risco é menor ainda: o epub.js só roda no bundle do leitor, sobre os livros que a própria pessoa importou. Reavaliar se sair uma versão nova.

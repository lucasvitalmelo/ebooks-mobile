# Arquitetura

Spec do MVP: [superpowers/specs/2026-10-22-mvp-design.md](superpowers/specs/2026-10-22-mvp-design.md).

## Visão geral

App Expo com Expo Router. Duas telas no MVP: Biblioteca (`src/app/index.tsx`) e Leitor (`src/app/book/[id].tsx`). O livro é renderizado pelo epub.js dentro de uma WebView — o epub.js depende do DOM, então não há como renderizar EPUB nativamente sem reescrever um motor de layout. Todo o resto (arquivos, banco, navegação) é nativo.

## Fronteiras

- `src/lib/db/`: SQLite atrás de uma interface `Db` pequena; no app, `expo-sqlite`; nos testes, `node:sqlite`.
- `src/reader/protocol.ts`: única via entre RN e a WebView (comandos `open`, `next`, `prev`, `goTo`, `setTheme`; eventos `ready`, `relocated`, `error`).
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

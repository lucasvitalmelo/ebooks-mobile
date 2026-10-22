# E-books Mobile — MVP (design)

Data: 2026-10-22

## Objetivo

Portar o leitor de EPUB web (`study/leitor_epub`) para um app Android nativo em React Native, com o objetivo principal de **aprender desenvolvimento mobile**. O MVP é a primeira de quatro fatias:

1. **MVP (este spec)** — importar `.epub`, biblioteca com capas, leitor, progresso salvo, tema de leitura.
2. Grifos e seleção de texto.
3. Login Google e sync com o Drive.
4. Extras nativos ("Abrir com…", tela sempre ligada, botões de volume).

Cada fatia tem seu próprio spec → plano → implementação.

**Só Android.** iOS fica para depois do MVP. O código continua multiplataforma (Expo); qualquer comportamento específico de Android fica isolado com `Platform`. Portar para iOS depois deve ser principalmente assinatura, build e teste no aparelho.

## Stack

- Expo (SDK estável mais recente no momento do scaffold) + TypeScript (strict)
- Expo Router (navegação por arquivos)
- `expo-document-picker`, `expo-file-system`, `expo-sqlite`, `expo-crypto`
- `react-native-webview` + epub.js (bundle próprio carregado na WebView)
- JSZip + parser de XML para metadados/capa fora da WebView
- Zustand (estado global)
- Jest + `jest-expo` (testes), ESLint (flat config), Prettier
- EAS Build (APK de Android)

## Arquitetura

### Telas

- `app/index.tsx` — Biblioteca: grade de capas, botão de importar, toque abre o livro, toque longo remove (com confirmação).
- `app/book/[id].tsx` — Leitor: WebView em tela cheia; toque no centro mostra/esconde a barra; botão abre a folha de aparência.
- Folha de aparência (bottom sheet dentro do leitor): tema (cores), fonte, tamanho, entrelinha, margem.

### Unidades

| Unidade                     | Responsabilidade                                                                                          | Depende de           |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------- |
| `src/lib/epub/parse.ts`     | Valida o arquivo (assinatura ZIP, `mimetype`), lê `container.xml` → OPF → título, autor, capa             | JSZip, parser XML    |
| `src/lib/db/`               | Conexão, migrações e repositórios `books`, `progress`, `themes`, `settings`. Único lugar que toca o banco | interface `Db`       |
| `src/lib/files.ts`          | Caminhos e operações em `documentDirectory` (`books/<id>.epub`, `covers/<id>.png`)                        | `expo-file-system`   |
| `src/lib/import.ts`         | Orquestra o import: picker → parse → hash → dedupe → copiar → gravar; desfaz em caso de falha             | parse, files, db     |
| `src/reader/protocol.ts`    | Tipos e validação das mensagens RN ↔ WebView. Compartilhado pelos dois lados                              | —                    |
| `reader-web/`               | App web mínimo com epub.js que roda dentro da WebView; fala só pelo protocolo                             | epub.js, protocol    |
| `src/components/Reader.tsx` | Monta a WebView, envia comandos, recebe eventos                                                           | protocol             |
| `src/store/`                | Zustand: tema ativo                                                                                       | db (themes/settings) |

A camada de banco é escrita contra uma interface `Db` pequena (`exec`, `run`, `getAll`, `getFirst`). No app ela é implementada com `expo-sqlite`; nos testes, com `better-sqlite3` em Node, para que os repositórios sejam testados com SQL real.

### Protocolo RN ↔ WebView

Mensagens JSON com campo `type`, validadas dos dois lados (mensagem inválida é descartada e logada).

- Comandos (RN → WebView): `open { base64, cfi? }`, `next`, `prev`, `goTo { cfi }`, `setTheme { theme }`
- Eventos (WebView → RN): `ready`, `relocated { cfi, percent }`, `error { message }`

Virar página: toque nas bordas laterais ou deslizar, tratado dentro da WebView.

### Bundle do leitor

`reader-web/` é compilado (Vite + `vite-plugin-singlefile`) num único HTML, com as fontes de leitura embutidas via `@font-face` (subconjunto das fontes do app web: Literata, Lora, Merriweather, Inter, Nunito). O build gera `src/reader/bundle.generated.ts` exportando o HTML como string; a WebView carrega com `source={{ html }}`. O arquivo gerado não é versionado: é produzido por `npm run reader:build`, chamado em `prestart`, `pretest`, no CI e no hook `eas-build-post-install`.

Risco conhecido: enviar o livro em base64 por `postMessage` pode ficar lento em livros muito grandes. Aceito no MVP; a alternativa (carregar por `file://` com acesso a arquivo liberado na WebView do Android) fica registrada caso apareça o problema.

## Dados

SQLite com migrações versionadas por `PRAGMA user_version`.

- `books`: `id` (SHA-256 do conteúdo), `title`, `author`, `filePath`, `coverPath` (nulo se o livro não tem capa), `size`, `addedAt`, `lastOpenedAt`
- `progress`: `bookId` (PK, FK), `cfi`, `percent`, `updatedAt`
- `themes`: `id`, `name`, `background`, `text`, `link`, `fontFamily`, `fontSize`, `lineHeight`, `margin`, `builtin`
- `settings`: chave/valor (`activeThemeId`)

O ID por hash evita importar o mesmo livro duas vezes e dá o mesmo ID ao mesmo livro em qualquer aparelho, o que prepara o sync da fatia 3.

## Fluxos

**Importar.** `getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true })` — o filtro é aberto porque no Android vários provedores informam `application/octet-stream` para EPUB; a validação real é do parser. Para cada arquivo: parse → hash → se o ID já existe, aviso "já está na biblioteca"; senão copia para `books/<id>.epub`, salva a capa em `covers/<id>.png` e grava em `books`. Falha em qualquer passo apaga os arquivos já copiados daquele livro. Ao fim, um resumo (importados, repetidos, inválidos).

**Abrir.** Lê `books/<id>.epub` em base64 → espera `ready` → `open { base64, cfi }` com o CFI salvo → atualiza `lastOpenedAt`. Cada `relocated` grava o progresso com debounce de ~1s; ao ir para o background (`AppState`), grava na hora.

**Aparência.** Mudança na folha → store → `setTheme` na WebView → persiste. Temas prontos (`builtin`) não podem ser apagados; o usuário pode criar os seus.

**Remover.** Confirmação → apaga arquivo, capa, `progress` e `books`.

**Erros.** EPUB inválido entra no resumo do import com o motivo. `error` vindo da WebView mostra uma tela de erro com botão de voltar. Falhas de banco/arquivo viram toast e log.

## Testes

Jest + `jest-expo`. Suite sempre verde; nenhum PR entra com teste quebrado.

- Parser: com `fixtures/livro-de-teste.epub` (copiado do projeto web) e arquivos inválidos gerados nos testes.
- Repositórios: com `better-sqlite3` atrás da interface `Db`.
- Import: orquestração com picker/arquivos falsos (dedupe, desfazer em falha).
- Protocolo: validação de mensagens válidas e inválidas.
- O que depende de aparelho (WebView renderizando, toques, picker real) se verifica no emulador Android ou no celular. E2E com Maestro fica para depois do MVP.

## Repositório e processo

Repo novo no GitHub: `ebooks-mobile`, pasta `study/ebooks-mobile`.

**Branches.** `main` (só releases) e `develop` (integração), ambas protegidas: sem push direto, PR exige CI verde. Features saem de `develop` como `feat/<nome>`; correções como `fix/<issue>-<nome>`. Todos os PRs entram por **merge commit** (squash e rebase desabilitados no repo).

**Bugs e issues.** Só vira issue o bug que já está em `develop` ou `main` (ex: começou uma feature nova e o bug já existia em `develop`). O PR da correção leva `Closes #N`. Bug que surge durante uma feature ainda não mergeada é corrigido na própria branch, sem issue.

**Commits.** Conventional Commits em português, imperativo, mensagem de uma linha, sem trailers de coautoria. **Commits por contexto**: dentro de um PR, cada conjunto coeso de arquivos vira um commit (ex: `package.json` sozinho, CHANGELOG sozinho, a feature em si com 20 arquivos). Commit, push e PR só com aprovação explícita do Lucas.

**Release.** release-please roda em push na `main`: abre/atualiza o PR de release com a versão nova (semver a partir dos commits) e o `CHANGELOG.md`. Atualiza também `expo.version` no `app.json` (`extra-files`). Ao mergear o PR de release saem a tag e a GitHub Release; um workflow dispara o EAS Build (perfil `preview`, APK), espera e anexa o APK à Release. O `versionCode` do Android é controlado pelo EAS (`appVersionSource: remote`, `autoIncrement`). Depois de cada release, PR `main` → `develop` para as duas não divergirem.

Fluxo de uma versão: features em `develop` → PR `develop` → `main` → release-please abre PR de release → merge → tag, Release, APK → PR `main` → `develop`.

O changelog lista uma linha por commit `feat`/`fix`, com link para o commit (com merge commit o número do PR não entra automaticamente). Isso foi aceito conscientemente.

**CI** (`.github/workflows/ci.yml`, em todo PR para `develop` e `main`): `npm ci` → `reader:build` → lint → `tsc --noEmit` → Jest → `npx expo-doctor`. Checks obrigatórios para merge.

**Outros.** Templates de issue (bug, feature) e de PR (checklist), labels padronizadas, Dependabot (npm e GitHub Actions, semanal, contra `develop`). Segredo `EXPO_TOKEN` no repo para o EAS.

## Documentação

- `README.md`: o que é, setup (Node, Android Studio/emulador, Expo Go), scripts, fluxo de trabalho resumido.
- `CONTRIBUTING.md`: branches, commits por contexto, issues, PRs, releases.
- `CLAUDE.md`: regras do projeto para o Claude Code, incluindo explicitamente as que sobrepõem as regras globais (commits por contexto em vez de um por task; quando abrir issue de bug; merge commit).
- `docs/ARCHITECTURE.md`: unidades, protocolo, modelo de dados, decisões com trade-off.
- `CHANGELOG.md`: gerado pelo release-please.

## Fora do escopo do MVP

Grifos/seleção, sync com Drive, "Abrir com…", iOS, E2E com Maestro, sumário/navegação por capítulos, busca no livro.

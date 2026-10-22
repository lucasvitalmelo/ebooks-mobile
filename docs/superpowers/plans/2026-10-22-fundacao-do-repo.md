# Fundação do repo ebooks-mobile — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended: inline, short loops) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o repo `ebooks-mobile` pronto para desenvolver o MVP: app Expo vazio rodando no Android, lint/types/testes verdes, CI obrigatório, release-please + APK via EAS, docs e fluxo de branches configurados no GitHub.

**Architecture:** Projeto Expo (template `blank-typescript`) com Expo Router adicionado à mão. Qualidade garantida por um único job de CI (`check`) exigido em `develop` e `main`. Releases saem da `main` pelo release-please, que no mesmo workflow dispara o EAS Build e anexa o APK à Release (precisa ser o mesmo workflow: eventos criados pelo `GITHUB_TOKEN` não disparam outros workflows).

**Tech Stack:** Expo SDK estável atual, TypeScript, Expo Router, ESLint (`eslint-config-expo`) + Prettier, Jest + `jest-expo` + `@testing-library/react-native`, GitHub Actions, release-please v4, EAS Build.

**Spec:** `docs/superpowers/specs/2026-10-22-mvp-design.md`. Este é o primeiro de dois planos: as funcionalidades do MVP (parser, banco, import, leitor, temas) vêm no plano seguinte, sobre esta base.

**Regras de commit deste repo** (sobrepõem as globais): Conventional Commits em português, imperativo, uma linha, sem trailers de coautoria; **um commit por contexto** (cada conjunto coeso de arquivos); tipos `feat`, `fix`, `docs`, `style`, `refactor`, `chore`, `test`. **Nenhum commit, push ou criação no GitHub sem aprovação explícita do Lucas** — os passos de commit abaixo são executados só depois dessa aprovação, mostrando antes a lista de commits.

**Pré-requisitos do Lucas:** conta Expo (expo.dev), app Expo Go no celular Android. Emulador do Android Studio é opcional.

---

## Estrutura de arquivos ao fim deste plano

```
ebooks-mobile/
  app/_layout.tsx            # Stack do Expo Router
  app/index.tsx              # tela inicial provisória (Biblioteca virá no plano 2)
  __tests__/home.test.tsx    # smoke test do Jest
  assets/                    # ícones do template
  docs/ARCHITECTURE.md       # visão da arquitetura planejada + decisões
  docs/superpowers/specs/    # spec do MVP
  docs/superpowers/plans/    # este plano
  .github/workflows/ci.yml
  .github/workflows/release.yml
  .github/ISSUE_TEMPLATE/{bug.yml,feature.yml,config.yml}
  .github/pull_request_template.md
  .github/dependabot.yml
  release-please-config.json
  .release-please-manifest.json
  eas.json  app.json  package.json  tsconfig.json
  eslint.config.js  .prettierrc  .prettierignore  .nvmrc  .gitignore
  README.md  CONTRIBUTING.md  CLAUDE.md
```

---

### Task 1: Scaffold do Expo

O `create-expo-app` reclama de pasta não vazia e cria um repo git próprio; por isso o scaffold é feito no scratchpad e copiado sem o `.git`.

**Files:** todos os do template, na raiz de `study/ebooks-mobile`.

- [ ] **Step 1: Gerar o projeto no scratchpad**

```bash
cd "C:/Users/LUCASV~1/AppData/Local/Temp/claude/C--Users-LucasVital-github-study-leitor-epub/5dc1a613-49d7-4d95-a103-94426097e020/scratchpad" && npx create-expo-app@latest ebooks-mobile --template blank-typescript --yes
```

Expected: `✅ Your project is ready!`

- [ ] **Step 2: Copiar para a pasta do projeto, sem `.git` e sem `node_modules`**

```bash
cd "C:/Users/LUCASV~1/AppData/Local/Temp/claude/C--Users-LucasVital-github-study-leitor-epub/5dc1a613-49d7-4d95-a103-94426097e020/scratchpad/ebooks-mobile" && rm -rf .git node_modules && cp -r . /c/Users/LucasVital/github/study/ebooks-mobile/
cd /c/Users/LucasVital/github/study/ebooks-mobile && npm install
```

Expected: `ls` mostra `App.tsx`, `index.ts`, `app.json`, `package.json`, `tsconfig.json`, `assets/` e `docs/` (preservado).

- [ ] **Step 3: Ajustar `app.json`**

Editar o `app.json` gerado, sem substituí-lo (as outras chaves variam com o SDK e o template já as gera certas). Só mudar/acrescentar dentro de `expo`:

```json
"name": "E-books",
"slug": "ebooks-mobile",
"version": "0.0.0",
"scheme": "ebooks",
"android": { "package": "com.lucasvitalmelo.ebooks" },
"plugins": ["expo-router"]
```

Em `android`, manter o que o template já tem (ícone adaptativo etc.) e só acrescentar `package`. Se `plugins` já existir, acrescentar `"expo-router"` à lista.

Em `package.json`, garantir `"version": "0.0.0"` e `"name": "ebooks-mobile"`.

- [ ] **Step 4: `.nvmrc`**

```
24
```

### Task 2: Expo Router com tela inicial

**Files:**

- Delete: `App.tsx`, `index.ts`
- Create: `app/_layout.tsx`, `app/index.tsx`
- Modify: `package.json` (`main`), `tsconfig.json`

- [ ] **Step 1: Instalar as dependências do router**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

- [ ] **Step 2: Apontar a entrada para o router**

Em `package.json`: `"main": "expo-router/entry"`. Apagar `App.tsx` e `index.ts`.

- [ ] **Step 3: `app/_layout.tsx`**

```tsx
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  )
}
```

- [ ] **Step 4: `app/index.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native'

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>E-books</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
})
```

- [ ] **Step 5: Alias `@/*` no `tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 6: Verificar no celular**

```bash
npx expo start
```

Abrir no Expo Go pelo QR code. Expected: tela branca com "E-books" centralizado. (Verificação do Lucas no aparelho.)

### Task 3: ESLint, Prettier e type-check

**Files:** Create `eslint.config.js`, `.prettierrc`, `.prettierignore`; Modify `package.json` (scripts).

- [ ] **Step 1: Gerar a config do ESLint do Expo**

```bash
npx expo lint
```

Expected: instala `eslint` e `eslint-config-expo` e cria `eslint.config.js`.

- [ ] **Step 2: Prettier**

```bash
npx expo install prettier eslint-config-prettier -- --save-dev
```

`eslint.config.js`:

```js
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const prettierConfig = require('eslint-config-prettier')

module.exports = defineConfig([expoConfig, prettierConfig, { ignores: ['dist/*', '.expo/*'] }])
```

`.prettierrc` (mesmo estilo do projeto web):

```json
{ "semi": false, "singleQuote": true, "printWidth": 120 }
```

`.prettierignore`:

```
node_modules
.expo
dist
android
ios
CHANGELOG.md
```

- [ ] **Step 3: Scripts em `package.json`**

```json
"lint": "expo lint",
"typecheck": "tsc --noEmit",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 4: Rodar tudo**

```bash
npm run format && npm run lint && npm run typecheck
```

Expected: sem erros.

### Task 4: Jest com smoke test

**Files:** Create `__tests__/home.test.tsx`; Modify `package.json`.

- [ ] **Step 1: Instalar**

```bash
npx expo install jest-expo jest @types/jest @testing-library/react-native -- --save-dev
```

- [ ] **Step 2: Configurar em `package.json`**

```json
"scripts": { "test": "jest" },
"jest": { "preset": "jest-expo" }
```

- [ ] **Step 3: Escrever o teste**

O Expo Router trata qualquer arquivo em `app/` como rota, então o teste fica fora dela, em `__tests__/home.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import Home from '../app/index'

test('mostra o nome do app', () => {
  render(<Home />)
  expect(screen.getByText('E-books')).toBeTruthy()
})
```

- [ ] **Step 4: Rodar**

```bash
npm test
```

Expected: `Tests: 1 passed`. Para conferir que o teste testa algo, trocar temporariamente o texto em `app/index.tsx` e ver falhar; desfazer.

- [ ] **Step 5: Saúde do projeto**

```bash
npx expo-doctor
```

Expected: todos os checks passam. Corrigir o que ele apontar (normalmente versões fora do SDK → `npx expo install --fix`).

### Task 5: EAS

**Files:** Create `eas.json`; `app.json` ganha `extra.eas.projectId` e `owner` (via `eas init`).

- [ ] **Step 1: `eas.json`**

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "autoIncrement": true
    },
    "production": { "autoIncrement": true }
  }
}
```

O `appVersionSource: remote` deixa o `versionCode` do Android com o EAS; a versão visível (`expo.version`) é a que o release-please atualiza.

- [ ] **Step 2: Login e vínculo (Lucas, no terminal)**

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

Expected: `app.json` ganha `"owner"` e `"extra": { "eas": { "projectId": "..." } }`.

- [ ] **Step 3 (opcional, gasta 1 build da cota grátis): build manual de teste**

```bash
npx eas-cli@latest build --platform android --profile preview
```

Expected: link do APK; instalar no celular e ver "E-books".

### Task 6: CI

**Files:** Create `.github/workflows/ci.yml`.

- [ ] **Step 1: Workflow**

```yaml
name: CI

on:
  pull_request:
    branches: [develop, main]

jobs:
  check:
    name: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --ci
      - run: npx expo-doctor
```

O nome do job (`check`) é o que a proteção de branch exige na Task 9. O plano 2 acrescenta `npm run reader:build` antes do lint.

### Task 7: release-please + APK

**Files:** Create `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release.yml`.

- [ ] **Step 1: `release-please-config.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "bump-minor-pre-major": true,
      "include-component-in-tag": false,
      "changelog-sections": [
        { "type": "feat", "section": "Funcionalidades" },
        { "type": "fix", "section": "Correções" },
        { "type": "refactor", "section": "Refatorações" },
        { "type": "docs", "section": "Documentação" },
        { "type": "chore", "section": "Manutenção", "hidden": true },
        { "type": "style", "section": "Estilo", "hidden": true },
        { "type": "test", "section": "Testes", "hidden": true },
        { "type": "ci", "section": "CI", "hidden": true }
      ],
      "extra-files": [{ "type": "json", "path": "app.json", "jsonpath": "$.expo.version" }]
    }
  }
}
```

- [ ] **Step 2: `.release-please-manifest.json`**

```json
{ ".": "0.0.0" }
```

Com `bump-minor-pre-major`, o primeiro `feat` gera `0.1.0`.

- [ ] **Step 3: `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          target-branch: main
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

  apk:
    needs: release-please
    if: ${{ needs.release-please.outputs.release_created == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - name: Build e anexa o APK à Release
        env:
          TAG: ${{ needs.release-please.outputs.tag_name }}
          GH_TOKEN: ${{ github.token }}
        run: |
          eas build --platform android --profile preview --non-interactive --wait --json > build.json
          url=$(jq -r '.[0].artifacts.buildUrl' build.json)
          curl -fsSL "$url" -o "ebooks-$TAG.apk"
          gh release upload "$TAG" "ebooks-$TAG.apk"
```

### Task 8: Documentação e templates do GitHub

**Files:** Create `README.md` (substitui o do template, se houver), `CONTRIBUTING.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `.github/ISSUE_TEMPLATE/bug.yml`, `.github/ISSUE_TEMPLATE/feature.yml`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/pull_request_template.md`, `.github/dependabot.yml`.

- [ ] **Step 1: `README.md`**

````markdown
# E-books (mobile)

Leitor de EPUB pessoal para Android, em React Native (Expo). Porta do leitor web [leitor_epub](https://github.com/lucasvitalmelo/leitor_epub) — e projeto de estudo de desenvolvimento mobile. Tudo fica no aparelho: livros, progresso e temas.

## Setup

1. Node 24 (`.nvmrc`)
2. `npm install`
3. `npx expo start` e abrir no app **Expo Go** do celular (ou num emulador do Android Studio, tecla `a`)

## Scripts

```bash
npm start              # servidor de desenvolvimento (Expo)
npm test               # Jest
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run format         # Prettier (escreve)
npm run format:check   # Prettier (só confere; roda no CI)
```

## Fluxo de trabalho

Branches `main` (releases) e `develop` (integração); features em `feat/<nome>` saindo de `develop`, correções em `fix/<issue>-<nome>`. Tudo entra por PR com merge commit e CI verde. Releases pelo release-please, com o APK anexado na Release. Detalhes em [CONTRIBUTING.md](CONTRIBUTING.md); arquitetura em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Roadmap

- [ ] MVP: importar EPUB, biblioteca, leitor, progresso, temas
- [ ] Grifos e seleção de texto
- [ ] Login Google e sync com o Drive
- [ ] Extras nativos ("Abrir com…", tela ligada, botões de volume)
- [ ] iOS
````

- [ ] **Step 2: `CONTRIBUTING.md`**

```markdown
# Como contribuir

## Branches

- `main`: só releases. Recebe PRs de `develop` e o PR de release do release-please.
- `develop`: integração. Recebe PRs de features e correções.
- Features: `feat/<nome>`, a partir de `develop`.
- Correções de bug com issue: `fix/<numero-da-issue>-<nome>`, a partir de `develop`.

Ninguém faz push direto em `main` ou `develop`. Todo PR entra por **merge commit** (squash e rebase estão desligados) e só com o check `check` do CI verde.

## Issues de bug

Só vira issue o bug que **já está em `develop` ou `main`** — por exemplo, ao começar uma feature nova você nota um bug que já existia em `develop`. O PR que corrige leva `Closes #N` na descrição.

Bug que aparece durante uma feature ainda não mergeada é corrigido na própria branch, sem issue.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) em português, no imperativo, mensagem de uma linha: `tipo(escopo opcional): descrição`.

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`, `test`.

**Um commit por contexto**: dentro de um PR, cada conjunto coeso de arquivos vira um commit. Uma mudança no `package.json` pode ser um commit sozinho; uma feature pode ter 20 arquivos num commit só. O que importa é cada commit contar uma coisa fechada, para o histórico ser fácil de ler.

## Releases

1. PR `develop` → `main`.
2. O release-please abre (ou atualiza) o PR de release com a versão nova e o `CHANGELOG.md`, calculados a partir dos commits.
3. Mergear o PR de release gera a tag, a GitHub Release e o APK anexado.
4. PR `main` → `develop` para trazer o commit de release de volta.

O PR de release é aberto pelo bot do GitHub Actions, e PRs do bot não disparam o CI; por isso ele é mergeado por um admin (`gh pr merge <n> --merge --admin`). O conteúdo dele é só versão e changelog.

## Testes

A suite fica sempre verde: nenhum PR entra com teste, lint, types ou formatação quebrados. Testes cobrem lógica pura, banco e protocolo do leitor; o que depende do aparelho se verifica no emulador ou no celular.
```

- [ ] **Step 3: `CLAUDE.md`**

```markdown
# CLAUDE.md

Guia para trabalhar neste projeto com Claude Code. Produto e setup em [README.md](README.md); processo em [CONTRIBUTING.md](CONTRIBUTING.md); arquitetura em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Sobre o projeto

Leitor de EPUB para Android em React Native (Expo), porta do leitor web `study/leitor_epub`. Objetivo principal: aprender desenvolvimento mobile. Só Android por enquanto; o código continua multiplataforma e o que for específico de Android fica isolado com `Platform`.

## Stack

Expo + TypeScript · Expo Router · expo-sqlite · expo-file-system · react-native-webview + epub.js · Zustand · Jest (jest-expo) · ESLint + Prettier · EAS Build

## Comandos

npm start · npm test · npm run lint · npm run typecheck · npm run format:check · npx expo-doctor

## Regras que sobrepõem as globais

- **Commits por contexto**, não um por task: dentro de um PR, cada conjunto coeso de arquivos é um commit. Continua valendo: mensagem de uma linha, sem corpo, sem trailers de coautoria, e nada de commit, push ou PR sem aprovação explícita do Lucas na conversa.
- **Merge commit** em todos os PRs (`gh pr merge --merge`). Nunca squash ou rebase.
- **Issue de bug só para bug que já está em `develop` ou `main`.** Bug surgido numa feature ainda não mergeada é corrigido na própria branch, sem issue. PR de correção leva `Closes #N`.
- Toda feature sai de `develop` numa branch `feat/<nome>` e volta por PR para `develop`.

## Convenções de código

- Alias `@/*` → `src/*`.
- Banco só pelos repositórios em `src/lib/db/`; ninguém usa o SQLite direto fora dali.
- Comunicação com a WebView do leitor só pelo protocolo em `src/reader/protocol.ts`.
- Sem comentários explicando o óbvio — só quando houver uma razão não evidente.
- Testes ao lado do código (`*.test.ts`) ou em `__tests__/` quando o arquivo está em `app/` (tudo em `app/` vira rota).

## Documentação

Mudança de arquitetura, troca de lib ou decisão com trade-off atualiza `docs/ARCHITECTURE.md` no mesmo PR. O `CHANGELOG.md` é gerado pelo release-please — não editar à mão.
```

- [ ] **Step 4: `docs/ARCHITECTURE.md`**

```markdown
# Arquitetura

Spec do MVP: [superpowers/specs/2026-10-22-mvp-design.md](superpowers/specs/2026-10-22-mvp-design.md).

## Visão geral

App Expo com Expo Router. Duas telas no MVP: Biblioteca (`app/index.tsx`) e Leitor (`app/book/[id].tsx`). O livro é renderizado pelo epub.js dentro de uma WebView — o epub.js depende do DOM, então não há como renderizar EPUB nativamente sem reescrever um motor de layout. Todo o resto (arquivos, banco, navegação) é nativo.

## Fronteiras

- `src/lib/db/`: SQLite atrás de uma interface `Db` pequena; no app, `expo-sqlite`; nos testes, `better-sqlite3`.
- `src/reader/protocol.ts`: única via entre RN e a WebView (comandos `open`, `next`, `prev`, `goTo`, `setTheme`; eventos `ready`, `relocated`, `error`).
- `reader-web/`: app web mínimo com epub.js compilado num único HTML embutido no app.

## Decisões

- **React Native com Expo** em vez de Capacitor: o objetivo é aprender mobile, e o Capacitor só empacotaria o app web. Expo também compila na nuvem (EAS), o que permite iOS no futuro sem Mac.
- **Jest em vez de Vitest**: Vitest não suporta bem o ecossistema RN; `jest-expo` é o padrão.
- **release-please com merge commit**: o changelog sai por commit (link para o hash), não por PR — o número do PR só entra automaticamente com squash, que não usamos. Aceito.
- **PR de release mergeado por admin**: PRs abertos pelo `GITHUB_TOKEN` não disparam o CI, então o check obrigatório nunca rodaria nele.
- **Build do APK no mesmo workflow do release-please**: a Release criada pelo `GITHUB_TOKEN` não dispara outro workflow.
- **`versionCode` remoto no EAS**: evita commitar contador de build; a versão visível vem do release-please.
```

- [ ] **Step 5: Templates de issue**

`.github/ISSUE_TEMPLATE/bug.yml`:

```yaml
name: Bug
description: Bug que já está em develop ou main
labels: [bug]
body:
  - type: textarea
    id: o-que
    attributes:
      label: O que acontece
    validations:
      required: true
  - type: textarea
    id: passos
    attributes:
      label: Como reproduzir
      placeholder: "1. ...\n2. ..."
    validations:
      required: true
  - type: textarea
    id: esperado
    attributes:
      label: O que deveria acontecer
    validations:
      required: true
  - type: input
    id: onde
    attributes:
      label: Onde
      description: Branch ou versão, aparelho e versão do Android
    validations:
      required: true
```

`.github/ISSUE_TEMPLATE/feature.yml`:

```yaml
name: Feature
description: Ideia ou funcionalidade nova
labels: [enhancement]
body:
  - type: textarea
    id: o-que
    attributes:
      label: O que
    validations:
      required: true
  - type: textarea
    id: por-que
    attributes:
      label: Por quê
    validations:
      required: true
```

`.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false
```

- [ ] **Step 6: `.github/pull_request_template.md`**

```markdown
## O que muda

## Por quê

Closes #

## Checklist

- [ ] Branch saiu de `develop` (ou é `develop` → `main`)
- [ ] Commits por contexto, Conventional Commits em português
- [ ] `npm test`, `npm run lint`, `npm run typecheck` e `npm run format:check` passam
- [ ] Verificado no celular/emulador (se mexe em tela)
- [ ] `docs/ARCHITECTURE.md` atualizado (se houve decisão de arquitetura)
```

- [ ] **Step 7: `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    target-branch: develop
    schedule:
      interval: weekly
    groups:
      expo:
        patterns: ['expo', 'expo-*', 'react-native', 'react-native-*', 'react', 'react-dom']
  - package-ecosystem: github-actions
    directory: /
    target-branch: develop
    schedule:
      interval: weekly
```

O grupo `expo` existe porque as versões de React Native e dos módulos Expo andam juntas com o SDK; atualizar um sozinho quebra o `expo-doctor`. Atualizações de SDK se fazem à mão com `npx expo install --fix`.

- [ ] **Step 8: Conferir tudo**

```bash
npm run format && npm run format:check && npm run lint && npm run typecheck && npm test
```

Expected: tudo passa.

### Task 9: Git, GitHub e proteção de branches

Cada passo aqui é com aprovação do Lucas: primeiro os commits, depois a criação do repo, depois o push e as configurações.

- [ ] **Step 1: Iniciar o git**

```bash
cd /c/Users/LucasVital/github/study/ebooks-mobile && git init -b main
```

Conferir o `.gitignore` do template: deve ignorar `node_modules/`, `.expo/`, `dist/`, `*.apk`, `.env*.local`. Acrescentar `*.apk` e `build.json` se faltarem.

- [ ] **Step 2: Commits por contexto (após aprovação da lista)**

Mostrar ao Lucas a lista abaixo com os arquivos de cada um e esperar o ok:

```bash
git add package.json package-lock.json app.json tsconfig.json .gitignore .nvmrc assets
git commit -m "chore: cria projeto Expo com TypeScript"
git add app
git commit -m "feat(app): adiciona Expo Router com tela inicial"
git add eslint.config.js .prettierrc .prettierignore
git commit -m "chore: configura ESLint e Prettier"
git add __tests__
git commit -m "test: adiciona smoke test da tela inicial"
git add eas.json
git commit -m "chore: configura builds do EAS"
git add .github/workflows/ci.yml
git commit -m "chore(ci): adiciona workflow de lint, types e testes"
git add release-please-config.json .release-please-manifest.json .github/workflows/release.yml
git commit -m "chore(ci): configura release-please e APK anexado à release"
git add .github/ISSUE_TEMPLATE .github/pull_request_template.md .github/dependabot.yml
git commit -m "chore(github): adiciona templates de issue e PR e Dependabot"
git add README.md CONTRIBUTING.md CLAUDE.md docs/ARCHITECTURE.md
git commit -m "docs: documenta setup, fluxo de trabalho e arquitetura"
git add docs/superpowers
git commit -m "docs: adiciona spec do MVP e plano da fundação"
git status
```

Expected: `nothing to commit, working tree clean`. Como os scripts do `package.json` mudaram em várias tasks, ele vai inteiro no primeiro commit — não dá para separar por task sem `git add -p`, e o contexto "projeto Expo configurado" é coeso.

- [ ] **Step 3: Criar o repo no GitHub (após aprovação)**

Público — proteção de branch em repo privado exige plano pago na conta grátis.

```bash
gh repo create lucasvitalmelo/ebooks-mobile --public --source . --description "Leitor de EPUB para Android em React Native (Expo)"
```

- [ ] **Step 4: Push de `main` e criação de `develop` (após aprovação)**

```bash
git push -u origin main
git checkout -b develop && git push -u origin develop
```

O push em `main` dispara o release-please, que abre o PR de release `0.1.0`; ele fica aberto acumulando até o fim do MVP. Conferir com `gh pr list`.

- [ ] **Step 5: Configurar o repo (após aprovação)**

```bash
gh repo edit lucasvitalmelo/ebooks-mobile --default-branch develop --enable-merge-commit --enable-squash-merge=false --enable-rebase-merge=false --delete-branch-on-merge
gh api -X PUT repos/lucasvitalmelo/ebooks-mobile/actions/permissions/workflow -f default_workflow_permissions=write -F can_approve_pull_request_reviews=true
```

`develop` como branch padrão faz PRs e o Dependabot mirarem nela por padrão. A permissão de workflow é o que deixa o release-please abrir PRs.

- [ ] **Step 6: Proteger `main` e `develop` (após aprovação)**

Ruleset em vez da proteção clássica: o ruleset deixa o admin passar por cima das regras **só dentro de um PR** (`bypass_mode: pull_request`), o que permite mergear o PR de release sem o CI e continua recusando push direto. Com a proteção clássica, `enforce_admins: false` liberaria também o push direto do admin.

```bash
gh api -X POST repos/lucasvitalmelo/ebooks-mobile/rulesets --input - <<'EOF'
{
  "name": "main e develop",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main", "refs/heads/develop"], "exclude": [] } },
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "check" }]
      }
    }
  ]
}
EOF
```

`actor_id: 5` é o papel Admin do repo. `required_approving_review_count: 0` obriga PR sem exigir revisor (projeto de uma pessoa); `allowed_merge_methods: ["merge"]` reforça o merge commit. Conferir com `gh api repos/lucasvitalmelo/ebooks-mobile/rulesets` — se a API recusar algum campo, ajustar pela doc de rulesets do GitHub antes de seguir.

- [ ] **Step 7: Segredo do EAS (Lucas)**

Criar um access token em expo.dev → Account settings → Access tokens, e rodar no terminal:

```bash
gh secret set EXPO_TOKEN --repo lucasvitalmelo/ebooks-mobile
```

(Colar o token quando pedir. O Claude não manipula o token.)

- [ ] **Step 8: Provar o fluxo com um PR de teste**

```bash
git checkout develop && git checkout -b chore/verifica-ci
```

Adicionar a linha `- [ ] Fundação do repo (CI, releases, docs)` marcada como `[x]` no topo do Roadmap do README; commit `docs: marca a fundação do repo no roadmap` (após aprovação); push; `gh pr create --base develop --fill`.

Expected: o check `check` roda e passa; o botão de merge só oferece "Create a merge commit". Mergear com `gh pr merge --merge` (após aprovação). Conferir que `git push origin develop` direto é recusado:

```bash
git checkout develop && git pull && git commit --allow-empty -m "test: push direto" && git push
```

Expected: `remote: error: GH013: Repository rule violations found`. Como o push foi recusado, o commit só existe localmente; desfazer com `git reset --hard origin/develop`.

---

## Depois deste plano

Plano 2 (MVP): copiar `fixtures/livro-de-teste.epub` do projeto web, parser de EPUB, interface `Db` + repositórios, `files.ts`, import, protocolo, `reader-web/` + `reader:build` (e o passo no CI e o hook `eas-build-post-install`), tela de Biblioteca, tela do Leitor, folha de aparência, temas prontos. Escrito depois que a fundação estiver no ar, partindo do que de fato foi gerado pelo template.

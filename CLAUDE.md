# CLAUDE.md

Guia para trabalhar neste projeto com Claude Code. Produto e setup em [README.md](README.md); processo em [CONTRIBUTING.md](CONTRIBUTING.md); arquitetura em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Leia o [AGENTS.md](AGENTS.md) antes de mexer em APIs do Expo/React Native.

## Sobre o projeto

Leitor de EPUB para Android em React Native (Expo), porta do leitor web `study/leitor_epub`. Objetivo principal: aprender desenvolvimento mobile. Só Android por enquanto; o código continua multiplataforma e o que for específico de Android fica isolado com `Platform`.

## Stack

Expo + TypeScript · Expo Router · expo-sqlite · expo-file-system · react-native-webview + epub.js · Zustand · Jest (jest-expo) · ESLint + Prettier · EAS Build

## Comandos

npm start · npm test · npm run lint · npm run typecheck · npm run format:check · npm run pdf:build · npx expo-doctor

## Regras que sobrepõem as globais

- **Commits por contexto**, não um por task: dentro de um PR, cada conjunto coeso de arquivos é um commit. Continua valendo: mensagem de uma linha, sem corpo, sem trailers de coautoria, e nada de commit, push ou PR sem aprovação explícita do Lucas na conversa.
- Tipos de commit: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`, `test`. Mudanças de CI/workflows usam `chore(ci)` (não existe tipo `ci`).
- **Merge commit** em todos os PRs (`gh pr merge --merge`). Nunca squash ou rebase.
- **Título do PR sem prefixo de tipo** (frase comum em português, não `feat(...)`): o título vai para o merge commit e o release-please o leria como mais um commit, duplicando o CHANGELOG (#19).
- **Issue de bug só para bug que já está em `develop` ou `main`.** A correção pode ir no PR da próxima feature, com um `Closes #N` por issue; não precisa de PR próprio. Bug surgido numa feature ainda não mergeada é corrigido na própria branch, sem issue.
- Toda feature sai de `develop` numa branch `feat/<nome>` e volta por PR para `develop`.

## Convenções de código

- Alias `@/*` → `src/*`.
- Banco só pelos repositórios em `src/lib/db/`; ninguém usa o SQLite direto fora dali.
- Comunicação com a WebView do leitor só pelo protocolo em `src/reader/protocol.ts`.
- Sem comentários explicando o óbvio — só quando houver uma razão não evidente.
- Testes ao lado do código (`*.test.ts`) ou em `__tests__/` para telas em `src/app/` (todo arquivo em `src/app/` vira rota).

## Documentação

Mudança de arquitetura, troca de lib ou decisão com trade-off atualiza `docs/ARCHITECTURE.md` no mesmo PR. O `CHANGELOG.md` é gerado pelo release-please — não editar à mão.

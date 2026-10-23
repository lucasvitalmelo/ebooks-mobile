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

`fixtures/livro-de-teste.epub` é copiado do leitor web (lá ele é gerado por `scripts/generate-test-epub.mjs`): 8 capítulos e notas, capa PNG, texto acentuado. Os testes do parser usam ele.

## Fluxo de trabalho

Branches `main` (releases) e `develop` (integração); features em `feat/<nome>` saindo de `develop`, correções em `fix/<issue>-<nome>`. Tudo entra por PR com merge commit e CI verde. Releases pelo release-please, com o APK anexado na Release. Detalhes em [CONTRIBUTING.md](CONTRIBUTING.md); arquitetura em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Roadmap

- [x] MVP: importar EPUB, biblioteca, leitor, progresso, temas
- [ ] Grifos e seleção de texto
- [ ] Login Google e sync com o Drive
- [ ] Extras nativos ("Abrir com…", tela ligada, botões de volume)
- [ ] iOS

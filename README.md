# E-books (mobile)

Leitor de EPUB pessoal para Android, em React Native (Expo). Porta do leitor web [leitor_epub](https://github.com/lucasvitalmelo/leitor_epub) — e projeto de estudo de desenvolvimento mobile. Tudo fica no aparelho (livros, progresso e temas), com sincronização opcional pelo Google Drive.

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
npm run pdf:build      # recompila o bundle do conversor de PDF (pdf-web/)
npm run pdf:generate   # regera fixtures/livro-de-teste.pdf
npm run icons:generate # regera os PNGs do ícone a partir de assets/icon.svg
```

`fixtures/livro-de-teste.epub` é copiado do leitor web (lá ele é gerado por `scripts/generate-test-epub.mjs`): 8 capítulos e notas, capa PNG, texto acentuado. Os testes do parser usam ele.

## Google Drive

Opcional: conectado, o app sincroniza livros, progresso, grifos e notas com o Google Drive. É a mesma biblioteca do leitor web (a pasta `MyBooks` e o `biblioteca.json`), então o que se lê num lado continua no outro. Os livros que estão só no Drive aparecem na aba "Disponíveis" e são baixados ao tocar.

Configuração única no Google Cloud, no mesmo projeto do leitor web (o acesso `drive.file` vale por projeto):

1. Credenciais → Criar credenciais → ID do cliente OAuth → Android.
2. Pacote `com.lucasvitalmelo.ebooks` e o SHA-1 do keystore de produção da EAS (`eas credentials -p android`, ou expo.dev → projeto → Credentials → Android).
3. Um build local de debug assina com outra chave: precisa de um segundo cliente Android com o SHA-1 da chave de debug.

Sem esse cliente, o login no APK falha com `DEVELOPER_ERROR`. O Drive só funciona no APK: no Expo Go o app abre normalmente e o Drive aparece como indisponível.

## Fluxo de trabalho

Branches `main` (releases) e `develop` (integração); features em `feat/<nome>` saindo de `develop`, bugs com issue podem ser corrigidos no PR da próxima feature (`Closes #N`). Tudo entra por PR com merge commit e CI verde. Releases pelo release-please, com o APK anexado na Release. Detalhes em [CONTRIBUTING.md](CONTRIBUTING.md); arquitetura em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Roadmap

- [x] MVP: importar EPUB, biblioteca, leitor, progresso, temas
- [x] Sumário e navegação por capítulos
- [x] Visual do leitor web e ponto de retorno
- [x] Grifos e seleção de texto
- [x] Busca, notas nos grifos, editar e exportar livro
- [x] Importar PDF (convertido em EPUB) e limpeza do estilo dos livros
- [x] Login Google e sync com o Drive
- [x] Luz da tela (temperatura que mantém o preto e brilho abaixo do mínimo do sistema), anel de progresso ao abrir um livro e tela de Configurações
- [ ] Extras nativos ("Abrir com…", botões de volume)
- [ ] iOS

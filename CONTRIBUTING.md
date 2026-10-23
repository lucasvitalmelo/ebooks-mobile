# Como contribuir

## Branches

- `main`: só releases. Recebe PRs de `develop` e o PR de release do release-please.
- `develop`: integração. Recebe PRs de features e correções.
- Features: `feat/<nome>`, a partir de `develop`.

Ninguém faz push direto em `main` ou `develop`: um ruleset do GitHub exige PR (sem mínimo de aprovações), o check `check` do CI verde e só permite **merge commit** (squash e rebase estão desligados); force push e exclusão dessas branches também são bloqueados.

## Issues de bug

Só vira issue o bug que **já está em `develop` ou `main`** — por exemplo, ao testar uma versão você acha um bug. A correção pode ir no PR da próxima feature (não precisa de um PR só para ela): o PR leva um `Closes #N` para cada issue que fecha.

Bug que aparece durante uma feature ainda não mergeada é corrigido na própria branch, sem issue.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) em português, no imperativo, mensagem de uma linha: `tipo(escopo opcional): descrição`.

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`, `test`. Mudanças de CI/workflows usam `chore(ci)`.

**Um commit por contexto**: dentro de um PR, cada conjunto coeso de arquivos vira um commit. Uma mudança no `package.json` pode ser um commit sozinho; uma feature pode ter 20 arquivos num commit só. O que importa é cada commit contar uma coisa fechada, para o histórico ser fácil de ler.

## Releases

1. PR `develop` → `main`.
2. O release-please abre (ou atualiza) o PR de release com a versão nova e o `CHANGELOG.md`, calculados a partir dos commits.
3. Mergear o PR de release gera a tag, a GitHub Release e o APK anexado.
4. PR `main` → `develop` para trazer o commit de release de volta.

O PR de release é aberto pelo bot do GitHub Actions, e PRs do bot não disparam o CI; por isso o check obrigatório nunca roda nele e ele é mergeado por um admin (`gh pr merge <n> --merge --admin`). O ruleset deixa o admin passar por cima das regras **só dentro de um PR** (bypass `pull_request`), então push direto continua recusado. O conteúdo do PR de release é só versão e changelog.

**Título do PR sem prefixo de tipo**: uma frase comum em português ("Banco SQLite com migrações e repositórios"), não `feat(db): ...`. O GitHub copia o título do PR para a mensagem do merge commit, e um título no formato Conventional Commits faria o release-please contar o PR como mais um commit, duplicando o CHANGELOG. Os commits dentro do PR continuam em Conventional Commits.

## Testes

A suite fica sempre verde: nenhum PR entra com teste, lint, types ou formatação quebrados. Testes cobrem lógica pura, banco e protocolo do leitor; o que depende do aparelho se verifica no emulador ou no celular.

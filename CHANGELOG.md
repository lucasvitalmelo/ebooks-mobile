# Changelog

## [0.3.0](https://github.com/lucasvitalmelo/ebooks-mobile/compare/v0.2.0...v0.3.0) (2026-10-23)


### Funcionalidades

* **app:** deriva as cores da interface do tema, como no leitor web ([875a611](https://github.com/lucasvitalmelo/ebooks-mobile/commit/875a61157ac9450e6f112ea4824f54c8835cfa50))
* **library:** lista o progresso de cada livro e guarda a opção de tela acesa ([65b65b0](https://github.com/lucasvitalmelo/ebooks-mobile/commit/65b65b0e33c4332d4de1662beadbe541d14d8b1b))
* **library:** redesenha a biblioteca como no leitor web ([35a2ce5](https://github.com/lucasvitalmelo/ebooks-mobile/commit/35a2ce5c9f3a9c46f1785a53716a95665bee739a))
* **reader:** adiciona o ponto de retorno e as barras fixas do leitor ([b00fff0](https://github.com/lucasvitalmelo/ebooks-mobile/commit/b00fff0362f9df42d9342c40485e4602b91bae56))
* **reader:** avisa saltos, começo e fim da página e posição da seleção ([3cf8c6b](https://github.com/lucasvitalmelo/ebooks-mobile/commit/3cf8c6badc9b18cb8b2d99bcda80e0409f1e938d))
* **reader:** porta o ponto de retorno e a posição do cartão do leitor web ([93c500a](https://github.com/lucasvitalmelo/ebooks-mobile/commit/93c500a8f899b865b45cb1cf2e359d50f6dc05e4))
* **reader:** redesenha ajustes, sumário e seleção como no leitor web ([edbecda](https://github.com/lucasvitalmelo/ebooks-mobile/commit/edbecda03042c49142861d051281c1a109c1e723))


### Documentação

* registra as decisões da v0.3 ([0fb9640](https://github.com/lucasvitalmelo/ebooks-mobile/commit/0fb96401d6cca482c6600bb726eff182410a013a))

## [0.2.0](https://github.com/lucasvitalmelo/ebooks-mobile/compare/v0.1.0...v0.2.0) (2026-10-23)


### Funcionalidades

* **db:** adiciona a tabela e o repositório de grifos ([73b587f](https://github.com/lucasvitalmelo/ebooks-mobile/commit/73b587f63618c96170f6819c6ea41d231b64c611))
* **reader:** acrescenta grifos, seleção e sumário ao protocolo ([78e095d](https://github.com/lucasvitalmelo/ebooks-mobile/commit/78e095da5cf55a7ec86538daa845c40184133f03))
* **reader:** adiciona sumário, grifos e barra aberta ao entrar no livro ([ba9187a](https://github.com/lucasvitalmelo/ebooks-mobile/commit/ba9187a48701c2eee53e0267284262822fd3d6ef))
* **reader:** resolve links, acerta toques em grifo e achata o sumário ([ea29456](https://github.com/lucasvitalmelo/ebooks-mobile/commit/ea29456e609fdf974d637d36b8f9bbba70ebb407))


### Correções

* alinha o include do tsconfig ao que o Expo SDK 58 grava ([eb181a4](https://github.com/lucasvitalmelo/ebooks-mobile/commit/eb181a412c3dbb7fcdef52173968124a1a47857f))
* **app:** faz a barra de status e a biblioteca seguirem o tema ([141525e](https://github.com/lucasvitalmelo/ebooks-mobile/commit/141525e9b3f79ae1cfa320eefc6c393ac2f88c0a))
* evita CHANGELOG duplicado com títulos de PR sem prefixo de tipo ([f434b79](https://github.com/lucasvitalmelo/ebooks-mobile/commit/f434b791eeb7568477a53eccb3958fdcea666d85))
* **reader:** trata links, grifos e seleção com listeners no capítulo ([13f1e98](https://github.com/lucasvitalmelo/ebooks-mobile/commit/13f1e9805050724fb3a16b170b67861135a1b615))


### Documentação

* registra a regra nova de issues e as decisões da v0.2 ([d8e2e75](https://github.com/lucasvitalmelo/ebooks-mobile/commit/d8e2e75cef175cca9950371d5f994d76cb0d7662))

## 0.1.0 (2026-10-23)


### Funcionalidades

* **app:** abre o banco na raiz do app ([4f01392](https://github.com/lucasvitalmelo/ebooks-mobile/commit/4f013920145ecd53cedcbd578409985e6249be40))
* **app:** adiciona Expo Router com tela inicial ([12c6ae4](https://github.com/lucasvitalmelo/ebooks-mobile/commit/12c6ae427ed006b50d41f94dc38d8b6edda9658c))
* **db:** adiciona interface Db, adaptador do expo-sqlite e migrações ([94aad76](https://github.com/lucasvitalmelo/ebooks-mobile/commit/94aad765a2faff48f9ef7a7f8e38fd258fd8bd32))
* **db:** adiciona repositórios de livros, progresso, temas e configurações ([359cded](https://github.com/lucasvitalmelo/ebooks-mobile/commit/359cded8d535659311886f2964e86d997f468abd))
* **db:** banco SQLite com migrações e repositórios ([c0a3039](https://github.com/lucasvitalmelo/ebooks-mobile/commit/c0a30399e6b01deccb7632b481e9fc1d69d4e9f6))
* **epub:** adiciona UTF-8 e SHA-256 em JS puro ([18f526a](https://github.com/lucasvitalmelo/ebooks-mobile/commit/18f526a3ac604a473986d7cbfc01023bf854eae7))
* **epub:** calcula o ID do livro com o algoritmo do leitor web ([bf9c397](https://github.com/lucasvitalmelo/ebooks-mobile/commit/bf9c397c6333d323433d7515d1e411163e18d496))
* **epub:** ID do livro e leitura de metadados e capa ([38270d2](https://github.com/lucasvitalmelo/ebooks-mobile/commit/38270d22ec654502e8c48b9a5a67c019f27f9e91))
* **epub:** lê título, autores e capa do EPUB ([5ed2088](https://github.com/lucasvitalmelo/ebooks-mobile/commit/5ed2088571759c7bbe5ed404182e9d736b0adb10))
* **files:** guarda livros e capas no diretório do app ([0067a21](https://github.com/lucasvitalmelo/ebooks-mobile/commit/0067a21a6292977642940bdb71ed339cb2011f41))
* **import:** importa EPUBs com dedupe e desfazendo falhas ([14d3cb4](https://github.com/lucasvitalmelo/ebooks-mobile/commit/14d3cb40fb40f43642de58eaabf429e7dfa9b61c))
* **library:** adiciona a biblioteca com importação e remoção ([dd1a34c](https://github.com/lucasvitalmelo/ebooks-mobile/commit/dd1a34cc37d68e2f4da7ac614cb54e2a5db7a5f4))
* **library:** importação de EPUB e tela de Biblioteca ([cfc57a7](https://github.com/lucasvitalmelo/ebooks-mobile/commit/cfc57a7cb17c87ec2c28c6dbb2a4bd296388b214))
* **reader:** abre o livro e salva o progresso ([f2025e4](https://github.com/lucasvitalmelo/ebooks-mobile/commit/f2025e48e2f704ce233cbb028bdc38f8fc19ecaf))
* **reader:** adiciona a folha de aparência ([20e538a](https://github.com/lucasvitalmelo/ebooks-mobile/commit/20e538aee754b637216370535b5da00f9406251c))
* **reader:** adiciona o leitor web com epub.js embutido no app ([d735b8c](https://github.com/lucasvitalmelo/ebooks-mobile/commit/d735b8c227ee0f8db72e796370eaca4d4f5d07cd))
* **reader:** adiciona o protocolo entre o app e a WebView ([0a8822c](https://github.com/lucasvitalmelo/ebooks-mobile/commit/0a8822c5f7f91a3b36af01845ab1cc20442402f1))
* **reader:** classifica toques e deslizes do leitor ([3abd0b3](https://github.com/lucasvitalmelo/ebooks-mobile/commit/3abd0b3acd635f69bf67578919daecbcac78f6a4))
* **reader:** folha de aparência com temas, fonte e espaçamento ([7560ded](https://github.com/lucasvitalmelo/ebooks-mobile/commit/7560deddcd806b833603407011f7db6e9fd475db))
* **reader:** leitor com epub.js numa WebView e progresso salvo ([3e61d1d](https://github.com/lucasvitalmelo/ebooks-mobile/commit/3e61d1d9858dc776226a87eadf826be144897036))
* **theme:** adiciona o store de tema com cópia ao ajustar um tema pronto ([393a78d](https://github.com/lucasvitalmelo/ebooks-mobile/commit/393a78d2547cf268fc120a0f232ca01a001b2392))


### Correções

* **ci:** define 0.1.0 como versão inicial da release ([5913aca](https://github.com/lucasvitalmelo/ebooks-mobile/commit/5913acacc9338e57e4183fdd7ad37965d4d58adc))
* **ci:** define 0.1.0 como versão inicial da release ([416b30f](https://github.com/lucasvitalmelo/ebooks-mobile/commit/416b30f1a6bb5c589f8c08c1a2a3f164b9930190))
* força LF na árvore de trabalho em qualquer sistema ([4e2ffd8](https://github.com/lucasvitalmelo/ebooks-mobile/commit/4e2ffd8946c3cab4a8e55097f6020aa84ec793ef))
* força LF na árvore de trabalho em qualquer sistema ([6e0969c](https://github.com/lucasvitalmelo/ebooks-mobile/commit/6e0969ce4f29fbbf0cbe6a6906d22f49aca2eaca))
* **github:** ignora no Dependabot os pacotes do SDK do Expo ([e2abf90](https://github.com/lucasvitalmelo/ebooks-mobile/commit/e2abf908004013cb63671ac13d1b2f813c8fdf9a))
* **github:** ignora no Dependabot os pacotes do SDK do Expo e saltos major ([8f6bca7](https://github.com/lucasvitalmelo/ebooks-mobile/commit/8f6bca77b5ef623c32ebaf5b1a317ee71aa31c68))


### Documentação

* adiciona o plano do MVP ([0a5c366](https://github.com/lucasvitalmelo/ebooks-mobile/commit/0a5c366df1aca9fa839acd623752990515ff27ed))
* adiciona spec do MVP e plano da fundação ([b38bdf6](https://github.com/lucasvitalmelo/ebooks-mobile/commit/b38bdf639e145822839dabe57b67311cf06c841f))
* ajusta o spec do MVP às decisões do plano ([4d216cc](https://github.com/lucasvitalmelo/ebooks-mobile/commit/4d216cc86e6a34b5c4766917b4e5d4993b677421))
* documenta setup, fluxo de trabalho e arquitetura ([98ae72e](https://github.com/lucasvitalmelo/ebooks-mobile/commit/98ae72efc43701e77f578d90ff23770e321b5417))
* marca o MVP como concluído no roadmap ([1bde440](https://github.com/lucasvitalmelo/ebooks-mobile/commit/1bde44048dfc3639508854c9468897e96dff4552))
* plano do MVP e ajustes no spec ([703e5d5](https://github.com/lucasvitalmelo/ebooks-mobile/commit/703e5d5f690468ad7c1c26480dc57e986f907b4a))
* registra as decisões de aparência ([42b2bfe](https://github.com/lucasvitalmelo/ebooks-mobile/commit/42b2bfe0d25388772c43d4b45adb558b956b64fb))
* registra as decisões do leitor ([b72491c](https://github.com/lucasvitalmelo/ebooks-mobile/commit/b72491c4d33cf6356f71f49eb8d6c5a70ec9b77d))
* registra caminhos relativos e o filtro do seletor ([dbb67c8](https://github.com/lucasvitalmelo/ebooks-mobile/commit/dbb67c8c851e638318a4a4166c6f463baa87af25))
* registra node:sqlite nos testes ([b04d756](https://github.com/lucasvitalmelo/ebooks-mobile/commit/b04d756e8a9bbe3758fe284f0f0c22adae1a6c1e))
* registra por que o Dependabot ignora os pacotes do SDK ([dfc05ba](https://github.com/lucasvitalmelo/ebooks-mobile/commit/dfc05bab6c03234372ae9a9069f3a3a9d0df658b))

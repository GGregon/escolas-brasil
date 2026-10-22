# Revisão para publicação

Revisão realizada em 22/10/2026, para publicação em
`GGregon/escolas-brasil`. A publicação inicial foi privada. Em 22/10/2026,
o mantenedor autorizou torná-lo **público** para habilitar a proteção da `main`.

## Atualização de visibilidade e proteção

O código e a release de dados passaram a ser públicos. O acesso não exige convite
ou autenticação. A `main` exige pull request, check `frontend` do GitHub Actions
aprovado, branch atualizado e conversas resolvidas. Exclusão e force push estão
bloqueados, inclusive para administradores. Não se exige aprovação de outra
pessoa para permitir manutenção individual. As menções à publicação privada nas
seções abaixo registram o estado da revisão e distribuição iniciais.

## Arquivos e credenciais

- Revisados código, scripts, notebook sem saídas, documentação e arquivos
  candidatos ao primeiro commit. Não foram encontrados tokens, chaves privadas,
  credenciais em URLs ou caminhos de usuário nesses arquivos.
- Não há `.env` necessário ou segredo embutido no frontend. Tokens usados pelo
  instalador de dados ficam no processo Python, nunca no JavaScript ou no Git.
- `.gitignore` exclui ambientes, caches, dados originais e gerados, builds,
  arquivos de ambiente, chaves e backups de cadastros manuais.
- As credenciais existentes do Git são usadas pelo gerenciador do sistema,
  sem serem impressas, copiadas para arquivos ou incluídas na publicação.
- `scripts/auditar_publicacao.py` repete verificações sobre os arquivos
  versionados e candidatos, sem imprimir o conteúdo de possíveis segredos.
  A busca por padrões não detecta todos os tipos possíveis de segredo.

## Dependências e superfície da aplicação

- `npm audit`: nenhum aviso de vulnerabilidade conhecido na revisão final.
- `pip-audit -r requirements.txt`: nenhum aviso conhecido na resolução final
  das dependências Python (13 pacotes, incluindo transitivas).
- Removidos Pillow e matplotlib: a geração antiga de imagens não é usada pelo
  mapa vetorial. Pillow 12.3.0, selecionado pela faixa anterior, tinha 24 avisos
  na consulta. A etapa obsoleta e a validação dessas imagens foram removidas.
- Pop-ups usam React/DOM e tooltips usam `setText`; conteúdo de escolas não é
  interpolado como HTML. Backups manuais têm validação de estrutura, tamanho,
  nomes, coordenadas e identificadores.
- A aplicação não possui backend ou contas de usuário. Cadastros manuais ficam
  no armazenamento local do navegador; não são publicados junto dos dados.
- Dev e preview escutam em loopback. A base cartográfica faz requisições ao
  OpenFreeMap, que recebe as informações usuais de uma conexão HTTP.

## Dados distribuídos

- Pacote separado de 35 arquivos de execução, com 413.974.012 bytes compactados.
  SHA-256 do ZIP e de cada arquivo registrados em `dados-release.json`.
- O instalador verifica o pacote inteiro antes de instalar, limita o tamanho do
  download, valida caminhos e não extrai arquivos inesperados. A credencial
  GitHub é removida dos redirecionamentos para o servidor de assets.
- Não contém CSVs originais, dados individuais de alunos, relatórios com caminhos
  locais, caches, camadas antigas ou cadastros manuais.
- O build copia somente a lista explícita de dados de execução. Créditos e
  avisos do estilo Bright acompanham o aplicativo e permanecem acessíveis no mapa.
- As fontes originais e seus limites de precisão estão documentados separadamente.

## Validação e manutenção

- 26 testes TypeScript e cinco testes Python do instalador aprovados.
- TypeScript e build de produção aprovados; instalação do pacote completo em
  diretório vazio conferida com hashes de todos os arquivos.
- Clone limpo conferido com instalação de dependências, 26 testes e build.
- Release privada publicada; o SHA-256 informado pelo GitHub coincide com o
  catálogo local. O CI do primeiro commit foi aprovado também no GitHub Actions.
- Verificação HTTP de dev e produção: worker JavaScript, HTTP Range dos PMTiles,
  31.053 escolas, 5.597 rótulos e ausência de informação em branco.
- Conferência integral dos setores e das associações espaciais executada contra
  as tabelas e geometrias locais.
- CI verifica testes, tipos, auditoria npm e arquivos publicáveis; Actions fixadas
  por SHA, com permissão somente de leitura e sem persistir credenciais do checkout.
- Dependabot acompanha npm, Python e GitHub Actions. Os avisos de segurança devem
  ser revistos periodicamente; os resultados acima refletem a data da consulta.
- Alertas de vulnerabilidade e atualizações automáticas de segurança habilitados
  no repositório, mantendo sua visibilidade privada.

O CI não executa o processamento nacional ou as verificações HTTP sem dados.
A revisão não é um pentest nem uma garantia de ausência de vulnerabilidades.

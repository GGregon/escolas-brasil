# Escolas Brasil

Mapa interativo de **468.099 setores do Censo 2022** e **31.053 escolas privadas
em atividade em 2025**, com busca por cidade ou escola e filtros por renda.

React, TypeScript, Vite, MapLibre GL e PMTiles. As geometrias são carregadas por
área e zoom; não é necessário banco de dados ou chave de API.

## Instalar e abrir

Requisitos: Git, **Node.js 22.12+ ou 24+**, npm e **Python 3.11+** para instalar os
dados. Internet é necessária para download e para a base Bright/OpenFreeMap.
Use um navegador atualizado com WebGL.

O repositório é privado: o mantenedor precisa conceder acesso à sua conta GitHub.
Autentique seu Git por HTTPS antes de clonar.

```sh
git clone https://github.com/GGregon/escolas-brasil.git
cd escolas-brasil
python scripts/baixar_dados.py
cd frontend
npm ci
npm run dev
```

Abra **http://127.0.0.1:5173/** e mantenha o terminal aberto. No Windows, após
instalar os dados, também é possível abrir `iniciar-mapa.cmd` com dois cliques.
Não abra `index.html` diretamente.

O instalador baixa o pacote da [release dados-v1](https://github.com/GGregon/escolas-brasil/releases/tag/dados-v1)
e verifica tamanho e SHA-256 do ZIP e de cada arquivo antes da instalação.
O pacote tem aproximadamente **414 MB**; reserve pelo menos **2 GB livres**
para download, validação e instalação. Os dados ficam separados do código.

Em repositórios privados, o instalador usa a credencial Git HTTPS já salva no
computador. Se sua autenticação for somente SSH, baixe o ZIP pela página da
release, estando logado no navegador, e instale a partir da raiz:

```sh
python scripts/baixar_dados.py --arquivo "caminho/dados-mapa-v1.zip"
```

O mantenedor também pode compartilhar esse mesmo ZIP. Para automação, é possível
definir `GITHUB_TOKEN` apenas no ambiente do processo, com leitura do repositório.
Nunca salve tokens em arquivos ou no Git. Não há `.env` obrigatório ou variável
`VITE_*` para configurar.

## Como usar

- Pesquise cidade ou escola. Enter ou clique direciona o mapa ao resultado.
- Escolha um dos seis indicadores do Censo. Verde indica valores menores e azul,
  maiores. Branco indica ausência ou supressão de informação.
- Ative o filtro pelo setor e ajuste as duas pontas do slider. Busca, pontos,
  agrupamentos e totais respeitam o intervalo selecionado.
- Clique na escola para abrir seus dados. A área dos círculos representa
  matrículas da educação básica, não alunos distintos.
- Ative ou oculte setores, estados, municípios e escolas geocodificadas.
- Adicione escola com nome, latitude e longitude. Esses cadastros ficam **somente
  no navegador**; use Exportar/Importar backup para preservar ou transferir.

## Dados e interpretação

| Camada | Fonte e referência |
| --- | --- |
| Renda e domicílios por setor | IBGE, Censo 2022, agregados de 08/05/2026 |
| Setores, estados e municípios | Malhas de 2022; 27 UFs e 5.570 municípios |
| Cadastro escolar e matrículas | INEP, Censo Escolar 2025 V2 |
| Coordenadas das escolas | Ipea/geobr 2025, release v2.0.0 |
| Ruas e base Bright | OpenFreeMap, OpenMapTiles e OpenStreetMap |

A renda é do responsável, **não renda domiciliar per capita**. A renda do setor
da escola não representa a renda de seus alunos ou famílias. Das 42.454 escolas
privadas em atividade, 11.401 não têm coordenadas aceitas para o mapa.
Geocodificações são aproximadas. Ausência ou supressão nunca vira renda zero.
A associação escola–setor usa a malha de exibição simplificada e exclui casos
ambíguos ou sem informação.

[Dicionário e fontes](docs/DADOS.md) · [Cobertura e precisão](docs/ESCOLAS.md)

## Desenvolvimento e publicação

```sh
cd frontend
npm test
npx tsc -b
npm audit
npm run build
npm run preview
```

Testes unitários e TypeScript funcionam sem os dados nacionais. O build exige
os dados instalados e gera `frontend/dist/`, incluindo somente arquivos usados
pelo mapa. O preview abre em **http://127.0.0.1:4173/**.

Para hospedar, sirva `frontend/dist/` em HTTPS com **HTTP Range
(`206 Partial Content`)** para `.pmtiles`. Preserve os créditos do mapa.
O repositório e sua release privados não criam um site acessível por si só.

[Pipeline e validações](docs/DESENVOLVIMENTO.md) · [Contribuir](CONTRIBUTING.md) ·
[Segurança](SECURITY.md) · [Revisão](docs/REVISAO_PUBLICACAO.md) ·
[Créditos](THIRD_PARTY_NOTICES.md)

```text
frontend/src/          Interface, mapa e testes
frontend/scripts/      Geração de tiles e validações JavaScript
scripts/               Instalação, preparação e validação de dados
docs/                  Fontes, metodologia e catálogo SHA-256
notebooks/             Exploração original, sem saídas salvas
.github/               CI e atualizações de dependências
```

Dados brutos, arquivos preparados, ambientes locais, dependências instaladas,
backups pessoais e builds são ignorados pelo Git; o lockfile npm é versionado.
As condições das fontes e dos componentes de terceiros continuam aplicáveis.

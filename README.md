# 🗺️ Escolas Brasil

Mapa interativo de **468.099 setores do Censo 2022** e **31.053 escolas privadas
em atividade em 2025**, com busca por cidade ou escola e filtros por renda.

React, TypeScript, Vite, MapLibre GL e PMTiles. As geometrias são carregadas por
área e zoom; não é necessário banco de dados ou chave de API.

![Mapa da região da Barra da Tijuca e Jacarepaguá, no Rio de Janeiro, com setores censitários coloridos por renda e escolas privadas em círculos laranja](docs/imagens/mapa-rio-de-janeiro.png)

*Renda média mensal por setor censitário e localização das escolas privadas no
Rio de Janeiro. Os controles ficam no painel lateral, com o mapa em tela ampla.*

**[Funcionalidades](#-funcionalidades)** · **[Instalação](#-instalar-e-abrir)** ·
**[Dados e indicadores](#-dados-e-interpretação)** ·
**[Desenvolvimento](#-desenvolvimento-e-publicação)**

> [!NOTE]
> A ferramenta permite explorar o contexto do **local da escola**. A renda do
> setor não representa a renda dos alunos, das famílias ou da própria instituição.

## ✨ Funcionalidades

| Recurso | O que você pode fazer |
| --- | --- |
| 🔎 Busca | Encontrar cidades e escolas pelo nome e direcionar o mapa ao resultado. |
| 🎨 Indicadores | Alternar entre seis indicadores de renda e domicílios do Censo 2022. |
| 🎚️ Filtro por intervalo | Mostrar as escolas em setores cujo indicador está na faixa selecionada. |
| 🏫 Detalhes da escola | Consultar código INEP, matrículas, origem das coordenadas e indicador do setor. |
| 🫧 Círculos e agrupamentos | Comparar matrículas e explorar escolas próximas agrupadas no mapa. |
| 🗂️ Camadas | Controlar setores, estados, municípios e escolas, incluindo as geocodificadas. |
| 📍 Cadastro manual | Incluir uma escola informando nome, latitude e longitude. |
| 💾 Backup | Exportar e importar os cadastros manuais entre navegadores ou computadores. |

### 🔎 Pesquisar e navegar

Digite o nome de uma cidade ou escola no campo **Pesquisar no mapa**. A busca
aceita nomes sem acentos; combine escola, cidade e UF para refinar os resultados.
Você pode restringir a busca a cidades ou escolas. Selecione um resultado com
o mouse ou pelo teclado e pressione **Enter**:

- **Cidade:** o mapa enquadra os limites do município.
- **Escola:** o mapa aproxima a coordenada e abre o cartão de informações.

Arraste para navegar e use o scroll para ajustar o zoom. As siglas dos estados
aparecem na visão mais distante; ao aproximar, surgem nomes de municípios e
detalhes das ruas. Os rótulos municipais independem da camada de contornos.

![Busca por uma escola em Niterói, com o mapa aproximado, cartão da escola aberto e filtro de renda ativo](docs/imagens/busca-e-filtro.png)

*Exemplo de busca pelo nome da escola, com detalhes da localização e filtro ativo.*

### 🎚️ Filtrar escolas pelo indicador do setor

1. Escolha o indicador no painel — por exemplo, **Renda média mensal**.
2. Marque **Filtrar escolas pelo setor**.
3. Arraste as **duas pontas do slider** para definir o intervalo desejado.
4. Use **Limpar filtro** para voltar a exibir todas as escolas permitidas pelas
   demais opções de camada.

<img src="docs/imagens/filtro-intervalo.png" alt="Filtro de renda média mensal com um único slider de duas pontas, valores mínimo e máximo e botão Limpar filtro" width="341">

O intervalo inclui os dois extremos. O filtro atualiza os pontos, a busca de
escolas, os agrupamentos, seus totais de matrículas e o contador. Os setores
fora da faixa ficam mais discretos para manter a orientação no mapa.
Ao trocar de indicador, o intervalo volta ao domínio completo do novo indicador.
As duas pontas também podem ser ajustadas pelo teclado.

> [!IMPORTANT]
> Com o filtro ativo, uma escola precisa estar associada a **um único setor**
> com valor publicado dentro do intervalo. Pontos sem associação, com associação
> ambígua ou com indicador ausente ficam fora do resultado. O slider usa escala
> não linear para facilitar a seleção de faixas mesmo com valores extremos.

### 🏫 Consultar uma escola

Clique no círculo da escola para abrir o **pop-up junto ao ponto selecionado**.
O cartão apresenta nome, município/UF, código INEP, matrículas de 2025, origem
das coordenadas e, quando disponível, código do setor e valor do indicador.
Quando há escolas na mesma coordenada, o seletor do cartão permite alternar
entre elas.

![Pop-up da Escola Eleva no Rio de Janeiro, mostrando código INEP, matrículas, origem das coordenadas e renda média mensal do setor](docs/imagens/detalhes-escola.png)

*O cartão mantém as informações próximas da escola, sem ocupar o painel de controles.*

A **área dos círculos** representa o total conhecido de matrículas da educação
básica. Escolas sem esse total usam um marcador de referência. Ao afastar o
mapa, escolas próximas podem formar agrupamentos; clique neles para aproximar.
Os agrupamentos somam matrículas conhecidas, com escala reduzida e tamanho limitado.

> [!NOTE]
> `QT_MAT_BAS` conta **matrículas**, não alunos distintos. Os tamanhos dos
> agrupamentos e dos pontos individuais usam escalas diferentes.

### 🗂️ Controlar camadas e cores

Ative ou oculte **setores censitários**, **estados**, **municípios** e
**escolas privadas**. A opção **Incluir geocodificadas** controla os pontos
com posição aproximada; a origem fica disponível no cartão da escola.

A legenda usa **verde para valores menores e azul para maiores**.
Setores sem informação aparecem em **branco**. As cores seguem classes do
indicador escolhido, preservam os limites dos setores e não têm suavização.
Ao aproximar, o preenchimento fica mais transparente para facilitar a leitura
das ruas na base Bright.

### 📍 Cadastrar escolas e guardar backups

Abra **Adicionar escola** e informe **nome, latitude e longitude**, em graus
decimais. O ponto passa a aparecer no mapa e na busca. Cadastros manuais não
recebem código INEP ou matrículas estimadas e podem ser excluídos individualmente.

Use **Exportar backup** para salvar os cadastros em JSON e **Importar backup**
para recuperá-los ou transferi-los para outro navegador ou computador.

> [!WARNING]
> Os cadastros manuais ficam **somente no navegador**, vinculados ao endereço
> e à porta da aplicação. Não existe sincronização ou banco compartilhado.
> Exporte um backup antes de limpar os dados do navegador ou mudar de endereço.

## 🚀 Instalar e abrir

Requisitos: Git, **Node.js 22.12+ ou 24+**, npm e **Python 3.11+** para instalar os
dados. Internet é necessária para download e para a base Bright/OpenFreeMap.
Use um navegador atualizado com WebGL.

> [!IMPORTANT]
> O repositório e o pacote de dados são **públicos**. Você pode clonar o projeto
> e baixar a release sem convite, login ou token do GitHub.

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

Para instalar sem o download automático, baixe o ZIP pela página da release
e execute a partir da raiz:

```sh
python scripts/baixar_dados.py --arquivo "caminho/dados-mapa-v1.zip"
```

O mantenedor também pode compartilhar esse mesmo ZIP. Não há `.env` obrigatório,
token ou variável `VITE_*` para configurar. O instalador também aceita credenciais
Git HTTPS ou `GITHUB_TOKEN` para cópias privadas do projeto; nunca salve tokens
em arquivos ou no Git.

## 📊 Dados e interpretação

### Indicadores disponíveis

| Código | Indicador | Unidade |
| --- | --- | --- |
| `V06001` | Pessoas responsáveis por domicílios particulares permanentes ocupados | Pessoas |
| `V06002` | Moradores nesses domicílios | Moradores |
| `V06003` | Variância do número de moradores nesses domicílios | Moradores² |
| `V06004` | Rendimento nominal médio mensal dos responsáveis com rendimento | R$ |
| `V06005` | Variância desse rendimento | R$² |
| `V06006` | Rendimento nominal mediano mensal dos responsáveis com rendimento | R$ |

Os valores monetários são **nominais de 2022**. A renda média e a mediana
consideram os responsáveis **com rendimento**. As variâncias descrevem a
dispersão e têm unidades ao quadrado; não são valores de renda ou contagens.

### Fontes e cobertura

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

## 🛠️ Desenvolvimento e publicação

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
O repositório e sua release públicos não criam um site hospedado por si só.

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

<details>
<summary>🔐 Proteção da main e fluxo de contribuição</summary>

O repositório é público e a `main` está protegida contra **exclusão e force push**.
Alterações devem entrar por **pull request**, com o branch atualizado e o check
`frontend` aprovado pelo GitHub Actions. Conversas de revisão precisam estar
resolvidas. As regras também se aplicam aos administradores.

O workflow verifica testes, tipos, auditoria npm e arquivos publicáveis. Não é
exigida aprovação de uma segunda pessoa, permitindo manutenção individual;
o pull request e as verificações continuam obrigatórios. Crie uma branch para
cada alteração e abra um pull request para a `main`.

Consulte a [documentação de branches protegidos do GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

</details>

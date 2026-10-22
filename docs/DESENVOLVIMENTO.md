# Desenvolvimento e metodologia

Aplicação local para explorar os 468.099 setores censitários do Brasil, os
indicadores do Censo 2022 e 31.053 escolas privadas em atividade em 2025.

**Front-end:** React 19, TypeScript, Vite e MapLibre GL. O mapa ocupa a tela,
com controles e legenda no painel lateral. As geometrias detalhadas são
carregadas em tiles vetoriais PMTiles, apenas para a área e o zoom visíveis.
Os dados censitários e escolares são servidos localmente. A base Bright,
do OpenFreeMap/OpenStreetMap, carrega ruas, fontes e imagens pela internet.
O navegador não descompacta nem indexa estados inteiros durante a navegação.

## Abrir o mapa

No Windows, dê dois cliques em **`iniciar-mapa.cmd`** na pasta do projeto.
O navegador abre em **http://127.0.0.1:5173/**. Mantenha a janela do servidor
aberta durante o uso. Node.js 22.12+ ou 24+ e npm são necessários.

Pelo terminal:

```powershell
cd frontend
npm ci
npm run dev
```

O aplicativo usa HTTP local; abrir `index.html` diretamente não executa a aplicação.
Instale os dados preparados conforme o README antes de executar a aplicação.

## Controles

- **Pesquisa:** nome de cidade ou escola, com filtros e suporte a nomes sem
  acentos. Combine nome, cidade e UF para refinar. Selecionar uma cidade
  enquadra seus limites; selecionar uma escola aproxima e abre seu pop-up.
  A busca escolar cobre os pontos já mapeados, não os cadastros sem coordenadas.
- **Indicador do Censo:** V06001 a V06006, com legenda e visão nacional próprias.
- **Filtrar escolas pelo setor:** ativa mínimo e máximo do indicador escolhido,
  inicialmente renda média mensal. Arraste as duas pontas de um único slider;
  os valores selecionados aparecem acima dele. Os limites são inclusivos. Ao trocar de
  indicador, a faixa volta ao domínio completo desse indicador. **Limpar filtro**
  restaura todas as escolas, inclusive sem associação/valor publicado.
  A busca de escolas, os pontos, os agrupamentos, seus totais de matrículas e
  o contador respeitam o intervalo e a opção de incluir geocodificadas.
  Setores fora da faixa continuam visíveis, mais discretos.
- **Camadas:** setores, estados, municípios e escolas privadas.
- **Incluir geocodificadas:** controla as escolas com posição aproximada.
- **Mouse:** arrastar para navegar, rolar ou clicar duas vezes para aproximar.
- **Clique:** consulta os indicadores do setor ou os dados da escola. Círculos
  maiores agrupam escolas próximas e aproximam o mapa ao serem clicados.
- **Escolas:** detalhes em um pop-up junto ao ponto destacado. O seletor no
  pop-up permite consultar escolas com a mesma coordenada.
- **Matrículas:** a área dos círculos representa `QT_MAT_BAS` da tabela de
  matrículas de 2025 (matrículas da educação básica, não alunos únicos).
  Agrupamentos somam os totais conhecidos, em escala reduzida e com raio
  limitado a 48 px. Escolas sem total usam um marcador de referência.
- **Adicionar escola:** informe nome, latitude e longitude em graus decimais.
  O cadastro aparece imediatamente no mapa e na pesquisa, inclusive com
  geocodificadas desligadas. Cadastros manuais não recebem código INEP ou
  matrículas estimadas. É possível localizar e excluir cada cadastro.
- **Salvar cadastros:** o navegador usa armazenamento local, vinculado ao
  endereço/porta da aplicação. Não há sincronização entre navegadores ou
  computadores. Use **Exportar backup / Importar backup** para transferir
  ou preservar os registros antes de limpar os dados do navegador.
- **Rótulos:** siglas dos estados até o zoom 6,5 e nomes dos municípios acima
  desse nível, com controle de sobreposição. Os nomes independem dos botões
  de contornos administrativos. Ruas e bairros vêm da base Bright.

As camadas administrativas usam os limites de 2022: 27 estados e 5.570 municípios.
A renda é de 2022; o cadastro escolar e o snapshot de coordenadas são de 2025.
Os valores ausentes ou suprimidos permanecem sem informação, em branco.
O preenchimento dos setores com dados fica mais transparente ao aproximar,
para facilitar a leitura das ruas; os valores originais são preservados.
A renda usa verde para valores menores e azul para valores maiores,
com os limites dos setores preservados e sem suavização. Nos outros
indicadores, as cores representam apenas menor/maior valor. A base Bright
mantém as avenidas em tons neutros e oculta pontos de ônibus.

O filtro associa a **coordenada da escola** ao setor, não a renda de alunos
ou famílias. O arquivo `escolas_setores.json` contém a associação das escolas
oficiais à malha exibida (simplificada em até 12 m), os seis valores originais
e os domínios dos sliders. Somente pontos estritamente dentro de um único
polígono são associados; não se escolhe o setor mais próximo. Ausência,
supressão e associação ambígua não são convertidas em renda zero.
Os cadastros manuais usam os tiles locais sob demanda. Pontos muito próximos
às bordas quantizadas dos tiles ficam sem associação em vez de receber um
setor incerto. O pop-up informa o setor e o valor do indicador usado.
O slider usa escala não linear para permitir faixas usuais mesmo com
valores extremos. As duas pontas também podem ser ajustadas pelo teclado.

## Organização

```text
frontend/                 Aplicação React e testes TypeScript
  src/                    Interface, controle do mapa e carregamento de dados
  public/data/            Assets gerados, fora do Git
  dist/                   Build de produção, fora do Git
scripts/                  Preparação e validação dos dados em Python
notebooks/                Notebook exploratório original, reorganizado
docs/                     Fontes, dicionário e metodologia
dados/brutos/             Fontes e caches de download, fora do Git
dados/processados/        Tabelas e relatórios de validação, fora do Git
```

Os dados completos, dependências instaladas e builds não são versionados.
O lockfile do front-end é versionado. Em um clone novo, prepare os assets
antes de abrir ou compilar o aplicativo.

## Preparar dados

Execute os comandos a partir da raiz do projeto, em um ambiente Python 3.11+:

```powershell
python -m pip install -r requirements.txt
python scripts/gerar_tabela.py
python scripts/preparar_malha.py
python scripts/baixar_escolas_geobr.py
python scripts/baixar_limites.py
python scripts/preparar_escolas.py --csv "C:\caminho\Tabela_Escola_2025_V2.csv"
python scripts/preparar_visualizacao.py
cd frontend
npm ci
npm run prepare:tiles
```

A rotina reutiliza os arquivos locais e baixa fontes ausentes. A malha completa
é grande; preserve os componentes extraídos para evitar novo download.
Use um ambiente virtual Python para as dependências do pipeline.
Mantenha `Tabela_Matricula_2025_V2.csv` na mesma pasta de `Tabela_Escola_2025_V2.csv`,
ou forneça seu caminho com `--matriculas`. Para atualizar apenas os totais,
execute `python scripts/preparar_matriculas.py --csv "C:\caminho\Tabela_Matricula_2025_V2.csv"`
e regenere os tiles `escolas` e `escolas-inep` com `REBUILD_TILES=1`.
Os arquivos dessas camadas usam o sufixo `-v2.pmtiles`.

## Verificar e compilar

```powershell
python scripts/validar_mapa.py
python scripts/validar_escolas.py
python scripts/validar_filtro_setores.py
cd frontend
npm test
npm run validate:tiles
npm run validate:filter
npm run build
npm run preview
```

O preview de produção abre em http://127.0.0.1:4173/.
Com dev e preview ativos, `npm run check:runtime` confere por HTTP o worker
do MapLibre em ambos os ambientes, além das leituras parciais dos PMTiles.
O worker ESM do MapLibre 6 é importado com `?worker&url` e registrado antes
de criar o mapa; isso é necessário para o Vite publicar suas dependências.
Os testes verificam os limites das classes, ausência versus zero, unidades,
troca de indicadores, camadas independentes, validade dos estilos MapLibre
e manutenção das fontes durante a ocultação dos setores. A validação dos tiles
decodifica os arquivos PMTiles e confere cobertura, os seis indicadores,
coordenadas das escolas e totais dos agrupamentos. A validação Python
confere integralmente as seis variáveis e as escolas contra suas tabelas.

Os arquivos em `frontend/public/data/tiles/` são gerados uma vez. Para refazer
todos os tiles, defina `$env:REBUILD_TILES='1'` antes de `npm run prepare:tiles`.
O servidor precisa responder a requisições HTTP Range (`206 Partial Content`);
os servidores de desenvolvimento e preview do Vite oferecem esse suporte.
`python scripts/preparar_rotulos.py` atualiza apenas os 5.597 pontos de
rotulagem a partir dos limites locais, sem refazer os tiles.
Os GeoJSONs compactados ficam como entradas de
preparação/validação; a interface não os carrega. Ao publicar, basta servir
os tiles, `manifest.json`, `escolas.json`, `rotulos.geojson` e os arquivos do aplicativo.
Inclua também `escolas_setores.json`. Ele é gerado junto com
`preparar_visualizacao.py`; pode ser atualizado isoladamente por
`python scripts/preparar_filtro_setores.py` quando mudarem escolas ou malhas.
`npm run validate:filter` usa o servidor dev ativo para conferir associações
por HTTP, intervalos e totais dos agrupamentos com os dados nacionais.

[Dados do Censo e geometrias](DADOS.md) · [Escolas, cobertura e precisão](ESCOLAS.md)

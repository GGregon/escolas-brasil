# Censo 2022: dados e geometrias

A tabela `dados/processados/renda_responsavel_setor_2022_BR.csv` contém uma linha
por setor da malha definitiva nacional do IBGE: **468.099 setores em 27 UFs**.
O agregado de renda foi publicado em 08/05/2026 e refere-se ao Censo 2022.

| Variável | Medida | Unidade |
| --- | --- | --- |
| V06001 | Pessoas responsáveis por domicílios particulares permanentes ocupados | Pessoas |
| V06002 | Moradores nesses domicílios | Moradores |
| V06003 | Variância do número de moradores | Moradores² |
| V06004 | Rendimento nominal médio mensal dos responsáveis com rendimento | R$ |
| V06005 | Variância desse rendimento nominal mensal | R$² |
| V06006 | Rendimento nominal mediano mensal dos responsáveis com rendimento | R$ |

Os valores monetários são nominais de 2022. A renda do responsável não é renda
domiciliar total nem renda domiciliar per capita. V06001 inclui responsáveis
que não integram necessariamente o universo com rendimento de V06004; não use
essa contagem como denominador para recalcular a média publicada.

## Integridade e ausências

`CD_SETOR` é texto de 15 dígitos. O cadastro da malha recebe a renda por um
`left join` validado como um para um. Setores ausentes no arquivo de renda
permanecem na tabela. Duplicidades, chaves inválidas e setores de renda sem
correspondência na malha interrompem a execução.

Os símbolos `X` e `.` são mantidos nas colunas `*_simbolo`; o valor numérico
fica nulo. Zero publicado continua zero. `presente_arquivo_renda` e
`status_renda_media` distinguem as situações da fonte. O status da renda média
descreve V06004; as demais variáveis têm suas próprias ausências preservadas.
`dados/processados/validacao.json` registra contagens, fontes e hashes SHA-256.

## Exibição

Cada indicador tem seis classes com limites fixos em `scripts/preparar_visualizacao.py`.
O limite superior de cada classe é inclusivo, tanto no raster nacional como
nos polígonos. As visões nacionais são rasterizações dos próprios valores por
setor, sem calcular médias por município ou estado.

As geometrias exibidas usam simplificação de 12 m em Web Mercator, com
preservação topológica por feição e precisão de seis casas decimais. Pequenos
desalinhamentos entre setores podem ocorrer. Os arquivos originais continuam
em `dados/brutos` para análises espaciais e medições.

O navegador carrega os polígonos detalhados a partir do zoom 7 e remove fontes
de UFs fora da janela. O cache de downloads conserva até quatro UFs. MapLibre
faz a renderização em WebGL e o agrupamento das escolas.

Os limites estaduais e municipais de 2022 vêm do snapshot simplificado do
Ipea/geobr. Os polígonos Lagoa Mirim e Lagoa dos Patos, presentes no arquivo
municipal, ficam fora da camada municipal. Os 5.570 recortes correspondem aos
5.568 municípios, Distrito Federal e Fernando de Noronha da divisão de 2022.
Os dois setores lacustres continuam preservados na base de setores.

## Fontes

- [Renda e dicionário IBGE, versão 08/05/2026](https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios_Rendimento_do_Responsavel/).
- [Malha definitiva nacional de 2022](https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/setores/shp/BR/BR_setores_CD2022.zip).
- [Dicionário da malha](https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/Dicionario_de_dados_malha_agregados.xlsx).
- [Ipea/geobr, release v2.0.0](https://github.com/ipea/geobr_prep_data/releases/tag/v2.0.0).

Os manifestos de download em `dados/brutos` fixam versão, URL e SHA-256 dos
snapshots. O manifesto `frontend/public/data/manifest.json` registra as classes,
unidades, cobertura e hash da tabela que alimenta o aplicativo.

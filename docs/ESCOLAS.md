# Escolas privadas — INEP 2025 e Ipea/geobr

A camada **Escolas privadas · 2025** combina o cadastro local
`Tabela_Escola_2025_V2.csv` com o snapshot `schools_2025.parquet` do Ipea/geobr,
release v2.0.0, associado pelo código INEP (`CO_ENTIDADE` / `code_school`).
A versão V2 do INEP retirou latitude e longitude. O dicionário da distribuição,
na célula Z39 da aba `Tabela_de_Escola`, orienta consultar o Catálogo de Escolas
para esses campos. O geobr distribui os dados de escolas com coordenadas.

O cadastro tem 51.758 escolas de dependência privada (`TP_DEPENDENCIA=4`),
incluindo 42.454 em atividade (`TP_SITUACAO_FUNCIONAMENTO=1`). A camada exibe
31.053 escolas ativas nas 27 UFs: 26.676 com coordenadas originais do INEP e
4.377 com posições geocodificadas. Cadastro e snapshot de coordenadas são de
2025. Município, dependência e situação foram conferidos entre as duas bases
para cada correspondência. Os nomes e categorias exibidos vêm do CSV V2 local.

## Precisão das posições

O geobr combina coordenadas INEP e geocodificações do geocodebr. A documentação
do método está [neste arquivo oficial do projeto](https://github.com/ipea/geobr/blob/master/r-package/R/read_schools.R).
Cada escola preserva `coords_source`, `precisao_geocodebr`,
`tipo_resultado_geocodebr` e `desvio_metros_geocodebr` na tabela preparada.
O campo de precisão geocodebr descreve a geocodificação, mesmo quando a posição
escolhida pelo geobr é a original do INEP; nesse caso, ele não descreve a precisão
da coordenada INEP.

Para a camada, são aceitas coordenadas INEP ou geocodificações em nível de
número, número aproximado ou logradouro, com desvio reportado de até 800 m.
As 11.401 escolas ativas restantes têm geocodificações insuficientemente
precisas, como CEP/localidade/município, e estão no relatório de exclusões.
O desvio reportado não garante erro máximo nem confirma a posição exata
do prédio escolar. Pontos geocodificados usam preenchimento suave e podem ser
ocultados em **Incluir geocodificadas**. A origem e a precisão aparecem na consulta.

As posições usadas são as geometrias selecionadas pelo geobr, convertidas de
SIRGAS 2000 (EPSG:4674) para WGS 84 (EPSG:4326) para apresentação no mapa.
São verificados valores finitos e a extensão geográfica do Brasil. Não foi
feita auditoria individual dos endereços nem validação de cada ponto contra
limites municipais. Coordenadas originais também podem conter erros cadastrais.

## Navegação

Em escalas amplas, os círculos agrupam escolas por proximidade na tela; o centro
do agrupamento não é uma escola. Clique para aproximar. A partir do zoom 15,
aparecem os pontos individuais. Escolas com coordenadas coincidentes permanecem
reunidas num ponto, cuja lista permite consultar cada código INEP.
Desative **Escolas privadas · 2025** para consultar setores sob os pontos.

O aplicativo usa `frontend/public/data/escolas.json` e os demais assets locais.
Abra com `iniciar-mapa.cmd` ou `npm run dev` dentro de `frontend`. A navegação
não consulta serviços externos de mapas nem requer chave de API.

Particulares, comunitárias, confessionais e filantrópicas são incluídas na
dependência privada do INEP. A renda de 2022 continua sendo uma medida do
setor censitário; não é renda dos estudantes ou da escola. A inclusão dos pontos
não calcula automaticamente a renda do setor de cada escola.

## Arquivos e reprodução

- `dados/processados/escolas_privadas_2025.csv`: 51.758 privadas, com
  coordenadas, situação e motivo de inclusão/exclusão.
- `dados/processados/escolas_privadas_2025_fora_do_mapa.csv`: 11.401 ativas
  excluídas por precisão insuficiente.
- `dados/processados/validacao_escolas_2025.json`: cobertura, regras, fontes e hashes.
- `frontend/public/data/escolas.json`: dados locais dos 31.053 pontos.
- `frontend/src/MapController.ts`: camadas e agrupamento de escolas.
- `frontend/src/App.tsx`: controles e consulta por escola.

Com o CSV do INEP já baixado, execute:

```powershell
python -m pip install -r requirements.txt
python scripts/baixar_escolas_geobr.py
python scripts/preparar_escolas.py --csv "C:\caminho\Tabela_Escola_2025_V2.csv"
python scripts/validar_escolas.py
```

O download do geobr é fixado pelo manifesto
`dados/brutos/geobr_escolas_2025_fonte.json`, com verificação do SHA-256 publicado
na [release v2.0.0](https://github.com/ipea/geobr_prep_data/releases/tag/v2.0.0).
Não é necessário instalar o pacote geobr: a rotina usa o mesmo snapshot
GeoParquet documentado pelo projeto. Para outro snapshot/versão, revise o
manifesto e o cadastro de origem antes de executar novamente.

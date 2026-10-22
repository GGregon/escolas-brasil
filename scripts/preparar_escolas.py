"""Associa escolas privadas de 2025 às coordenadas Ipea/geobr de 2025."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.deps'))

import geopandas as gpd
import numpy as np
import pandas as pd

from gerar_tabela import RAW, OUT

LOCAL = RAW/'Tabela_Escola_2025_V2.csv'
CATEGORIES = {'1':'Particular','2':'Comunitária','3':'Confessional','4':'Filantrópica'}
PRECISE = {'numero', 'numero_aproximado', 'logradouro'}


def sha256(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def preparar(csv, parquet, matriculas=None):
    matriculas = matriculas or csv.with_name('Tabela_Matricula_2025_V2.csv')
    if not matriculas.exists():
        raise FileNotFoundError(f'Informe a tabela de matrículas de 2025 com --matriculas: {matriculas}')
    cols = ['NU_ANO_CENSO','CO_ENTIDADE','NO_ENTIDADE','CO_UF','SG_UF','CO_MUNICIPIO','NO_MUNICIPIO',
            'TP_DEPENDENCIA','TP_SITUACAO_FUNCIONAMENTO','TP_CATEGORIA_ESCOLA_PRIVADA','TP_LOCALIZACAO']
    school = pd.read_csv(csv, sep=';', encoding='cp1252', usecols=cols, dtype='string')
    if not school.NU_ANO_CENSO.eq('2025').all() or not school.CO_ENTIDADE.str.fullmatch(r'\d{8}').all() or not school.CO_ENTIDADE.is_unique:
        raise ValueError('Ano ou identificador inválido no cadastro escolar')
    total = len(school)
    school = school.loc[school.TP_DEPENDENCIA.eq('4')].copy()
    geo = gpd.read_parquet(parquet)
    if not geo.year.eq(2025).all() or geo.crs is None:
        raise ValueError('Snapshot sem referência de 2025 ou sem CRS')
    geo['CO_ENTIDADE'] = geo.code_school.astype('Int64').astype('string')
    if not geo.CO_ENTIDADE.is_unique:
        raise ValueError('Códigos de escolas duplicados no geobr')
    positions = geo.to_crs(4326)
    geo['LATITUDE'] = positions.geometry.y
    geo['LONGITUDE'] = positions.geometry.x
    attrs = ['CO_ENTIDADE','LATITUDE','LONGITUDE','coords_source','precisao_geocodebr',
             'tipo_resultado_geocodebr','desvio_metros_geocodebr','code_muni','tp_dependencia','tp_situacao_funcionamento']
    result = school.merge(geo[attrs], on='CO_ENTIDADE', how='left', validate='one_to_one', indicator=True)
    matched = result['_merge'].eq('both')
    for local, remote in [('CO_MUNICIPIO','code_muni'),('TP_DEPENDENCIA','tp_dependencia'),('TP_SITUACAO_FUNCIONAMENTO','tp_situacao_funcionamento')]:
        if not pd.to_numeric(result.loc[matched,local]).eq(result.loc[matched,remote]).all():
            raise ValueError(f'Cadastro e snapshot divergem em {local}')
    result['categoria_privada'] = result.TP_CATEGORIA_ESCOLA_PRIVADA.map(CATEGORIES).fillna('Não informada')
    active = result.TP_SITUACAO_FUNCIONAMENTO.eq('1')
    valid = np.isfinite(result.LATITUDE) & np.isfinite(result.LONGITUDE)
    valid &= result.LATITUDE.between(-34, 6) & result.LONGITUDE.between(-74.1, -28)
    original = result.coords_source.eq('inep')
    geocoded = result.coords_source.eq('geocodebr')
    precise = geocoded & result.precisao_geocodebr.isin(PRECISE) & result.desvio_metros_geocodebr.between(0, 800)
    result['status_mapa'] = 'coordenada_ausente_ou_invalida'
    result.loc[matched & valid & geocoded, 'status_mapa'] = 'geocodificacao_imprecisa'
    result.loc[matched & valid & original, 'status_mapa'] = 'coordenada_inep'
    result.loc[matched & valid & precise, 'status_mapa'] = 'geocodificacao_numero_ou_logradouro'
    result.loc[~active, 'status_mapa'] = 'fora_de_atividade_2025'
    result['incluida_no_mapa'] = active & matched & valid & (original | precise)
    result['ano_coordenadas'] = 2025
    result['fonte_coordenadas'] = 'Ipea/geobr, schools_2025, release v2.0.0; origem individual em coords_source'
    result = result.drop(columns=['_merge','code_muni','tp_dependencia','tp_situacao_funcionamento']).sort_values('CO_ENTIDADE')
    selected = result.loc[result.incluida_no_mapa]
    OUT.mkdir(exist_ok=True, parents=True)
    output = OUT / 'escolas_privadas_2025.csv'
    result.to_csv(output, index=False, encoding='utf-8', lineterminator='\n')
    missing = result.loc[result.TP_SITUACAO_FUNCIONAMENTO.eq('1') & ~result.incluida_no_mapa]
    missing.to_csv(OUT / 'escolas_privadas_2025_fora_do_mapa.csv', index=False, encoding='utf-8', lineterminator='\n')
    manifest = json.loads((RAW/'geobr_escolas_2025_fonte.json').read_text(encoding='utf-8'))
    report = {
        'gerado_em_utc': datetime.now(timezone.utc).isoformat(), 'ano_cadastro':2025, 'ano_coordenadas':2025,
        'cadastro_csv':str(csv), 'fonte_geobr':manifest,
        'total_cadastro':total,'privadas_todas_situacoes':len(result),
        'privadas_ativas':int(result.TP_SITUACAO_FUNCIONAMENTO.eq('1').sum()),
        'privadas_com_correspondencia_geobr':int(matched.sum()),'incluidas_no_mapa':len(selected),
        'status_mapa':{str(k):int(v) for k,v in result.status_mapa.value_counts().items()},
        'fontes_dos_pontos_exibidos':{str(k):int(v) for k,v in selected.coords_source.value_counts().items()},
        'precisao_geocodificadas_exibidas':{str(k):int(v) for k,v in selected.loc[selected.coords_source.eq('geocodebr'),'precisao_geocodebr'].value_counts().items()},
        'politica_precisao':'INEP original ou geocodebr em nível de número/número aproximado/logradouro, com desvio reportado <= 800 m. CEP/localidade/município ficam fora da camada de pontos.',
        'sha256':{csv.name:sha256(csv),parquet.name:sha256(parquet),output.name:sha256(output)},
        'incluidas_por_uf':{str(k):int(v) for k,v in selected.groupby('SG_UF').size().items()},
    }
    (OUT/'validacao_escolas_2025.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    records = []
    for r in selected.itertuples():
        records.append([r.CO_ENTIDADE,r.NO_ENTIDADE,r.NO_MUNICIPIO,r.SG_UF,float(r.LATITUDE),float(r.LONGITUDE),
                        r.categoria_privada,r.coords_source,
                        None if pd.isna(r.precisao_geocodebr) else r.precisao_geocodebr,
                        None if pd.isna(r.desvio_metros_geocodebr) else float(r.desvio_metros_geocodebr)])
    data = {'ano':2025,'meta':{'privadas_ativas':report['privadas_ativas'],'mapeadas':len(records),
                            'fora_do_mapa':report['privadas_ativas']-len(records),
                            'origens':report['fontes_dos_pontos_exibidos']},'registros':records}
    asset_dir = ROOT/'frontend'/'public'/'data'
    asset_dir.mkdir(parents=True, exist_ok=True)
    (asset_dir/'escolas.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    from preparar_matriculas import preparar as preparar_matriculas
    preparar_matriculas(matriculas)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv',type=Path,default=LOCAL)
    parser.add_argument('--parquet',type=Path,default=RAW/'schools_2025.parquet')
    parser.add_argument('--matriculas',type=Path,help='Tabela_Matricula_2025_V2.csv; por padrão, na mesma pasta do cadastro')
    args = parser.parse_args()
    preparar(args.csv,args.parquet,args.matriculas)

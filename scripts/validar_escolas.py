"""Confere integralmente a camada de escolas distribuída no mapa."""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def validar():
    data = json.loads((ROOT/'frontend/public/data/escolas.json').read_text(encoding='utf-8'))
    table = pd.read_csv(ROOT/'dados/processados/escolas_privadas_2025.csv',dtype={'CO_ENTIDADE':'string','CO_UF':'string','CO_MUNICIPIO':'string'})
    assert table.CO_ENTIDADE.is_unique and table.TP_DEPENDENCIA.eq(4).all()
    assert table.NU_ANO_CENSO.eq(2025).all() and table.ano_coordenadas.eq(2025).all()
    selected = table.loc[table.incluida_no_mapa].set_index('CO_ENTIDADE').sort_index()
    rows = pd.DataFrame([row[:10] for row in data['registros']],columns=['CO_ENTIDADE','NO_ENTIDADE','NO_MUNICIPIO','SG_UF','LATITUDE','LONGITUDE','categoria_privada','coords_source','precisao_geocodebr','desvio_metros_geocodebr']).set_index('CO_ENTIDADE').sort_index()
    assert rows.index.is_unique and len(rows)==len(selected)==data['meta']['mapeadas']
    assert selected.TP_SITUACAO_FUNCIONAMENTO.eq(1).all()
    assert selected.SG_UF.nunique()==27
    pd.testing.assert_frame_equal(rows,selected[rows.columns],check_dtype=False,check_index_type=False)
    approximate = selected.loc[selected.coords_source.eq('geocodebr')]
    assert approximate.precisao_geocodebr.isin(['numero','numero_aproximado','logradouro']).all()
    assert approximate.desvio_metros_geocodebr.between(0,800).all()
    assert selected.LATITUDE.between(-34,6).all() and selected.LONGITUDE.between(-74.1,-28).all()
    assert len(selected)+data['meta']['fora_do_mapa']==data['meta']['privadas_ativas']
    excluded = pd.read_csv(ROOT/'dados/processados/escolas_privadas_2025_fora_do_mapa.csv',dtype={'CO_ENTIDADE':'string'})
    expected = table.loc[table.TP_SITUACAO_FUNCIONAMENTO.eq(1)&~table.incluida_no_mapa]
    assert set(excluded.CO_ENTIDADE)==set(expected.CO_ENTIDADE)
    assert not excluded.incluida_no_mapa.any()
    report = json.loads((ROOT/'dados/processados/validacao_matriculas_2025.json').read_text(encoding='utf-8'))
    enrollments = pd.read_csv(report['arquivo'],sep=';',encoding='cp1252',usecols=['CO_ENTIDADE','QT_MAT_BAS'],dtype={'CO_ENTIDADE':'string'}).set_index('CO_ENTIDADE').QT_MAT_BAS
    assert enrollments.index.is_unique
    for row in data['registros']:
        assert row[10] == (int(enrollments[row[0]]) if row[0] in enrollments else None)
    assert sum(row[10] or 0 for row in data['registros']) == data['matriculas']['total_mapeado']
    print(f'OK: {len(rows):,} escolas em 27 UFs; nomes, códigos, coordenadas e origens preservados. Exclusões: {len(excluded):,}.')


if __name__=='__main__':
    validar()

"""Conferência integral dos dados distribuídos no mapa interativo."""
import gzip
import json
from pathlib import Path

import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'frontend/public/data'
OUT=ROOT/'dados/processados'


def validar():
    config=json.loads((DEST/'manifest.json').read_text(encoding='utf-8'))
    variables=list(config['variables'])
    table=pd.read_csv(OUT/'renda_responsavel_setor_2022_BR.csv',dtype={'CD_SETOR':'string'}).set_index('CD_SETOR')
    table.index=table.index.astype(object)
    seen=set()
    for state in config['states']:
        data=json.loads(gzip.decompress((DEST/'setores'/f"{state['uf']}.geojson.gz").read_bytes()))
        features=data['features']
        assert len(features)==state['count']
        assert all(f['geometry']['type'] in ('Polygon','MultiPolygon') and f['geometry']['coordinates'] for f in features)
        attrs=pd.DataFrame([f['properties'] for f in features]).set_index('CD_SETOR')
        assert attrs.index.is_unique and all(code.startswith(state['uf']) for code in attrs.index)
        assert not (seen&set(attrs.index))
        seen.update(attrs.index)
        attrs.index=attrs.index.astype(object)
        pd.testing.assert_frame_equal(attrs[variables],table.loc[attrs.index,variables],check_dtype=False,rtol=1e-12,atol=1e-12)
        sigilo=table.loc[attrs.index,'V06001_simbolo'].eq('X').to_numpy()
        assert (attrs.sigilo.to_numpy()==sigilo).all()
    assert seen==set(table.index) and len(seen)==468099 and len(config['states'])==27
    for key,var in config['variables'].items():
        assert var['available']==int(table[key].notna().sum())
    for kind,count in [('estados',27),('municipios',5570)]:
        data=json.loads(gzip.decompress((DEST/f'{kind}.geojson.gz').read_bytes()))
        assert len(data['features'])==count==config['boundaries'][kind]
        assert len({f['properties']['code'] for f in data['features']})==count
    print('OK: 468.099 setores, seis variáveis, supressões e nulos preservados; 27 estados e 5.570 municípios.')


if __name__ == '__main__':
    validar()

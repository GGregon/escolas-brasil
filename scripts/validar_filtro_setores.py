"""Confere o índice espacial contra os polígonos e valores servidos no mapa."""
import gzip
import json
from pathlib import Path

from shapely.geometry import Point, shape

DEST=Path(__file__).resolve().parents[1]/'frontend/public/data'
KEYS=['V06001','V06002','V06003','V06004','V06005','V06006']
data=json.loads((DEST/'escolas_setores.json').read_text(encoding='utf-8'))
schools=json.loads((DEST/'escolas.json').read_text(encoding='utf-8'))['registros']
assert set(data['schools'])=={row[0] for row in schools}
manifest=json.loads((DEST/'manifest.json').read_text(encoding='utf-8'))
domains={key:{'min':float('inf'),'max':float('-inf')} for key in KEYS}
checked=0
for state in manifest['states']:
    rows=[row for row in schools if data['schools'][row[0]] and data['schools'][row[0]][0].startswith(state['uf'])]
    features=json.loads(gzip.decompress((DEST/'setores'/f"{state['uf']}.geojson.gz").read_bytes()))['features']
    by_code={feature['properties']['CD_SETOR']:feature for feature in features}
    geoms={}
    for feature in features:
        for key in KEYS:
            value=feature['properties'][key]
            if value is not None:
                domains[key]['min']=min(domains[key]['min'],value)
                domains[key]['max']=max(domains[key]['max'],value)
    for row in rows:
        sector=data['schools'][row[0]]
        feature=by_code[sector[0]]
        assert sector[1:]==[feature['properties'][key] for key in KEYS]
        if sector[0] not in geoms:
            geoms[sector[0]]=shape(feature['geometry'])
        assert geoms[sector[0]].contains(Point(row[5],row[4])),row[0]
        checked+=1
assert domains==data['domains']
assert checked==data['report']['associadas']
assert checked+data['report']['sem_setor']+data['report']['ambiguas']==len(schools)
print(f'OK: {checked} associações conferidas; seis indicadores e limites de domínio preservados.')

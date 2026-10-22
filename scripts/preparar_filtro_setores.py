"""Associa escolas aos polígonos da malha exibida; não usa setor mais próximo."""
import gc
import gzip
import json
from pathlib import Path

import geopandas as gpd
import numpy as np

DEST = Path(__file__).resolve().parents[1] / 'frontend/public/data'
KEYS = ['V06001','V06002','V06003','V06004','V06005','V06006']


def preparar():
    manifest = json.loads((DEST/'manifest.json').read_text(encoding='utf-8'))
    rows = json.loads((DEST/'escolas.json').read_text(encoding='utf-8'))['registros']
    points = gpd.GeoDataFrame({'id':[row[0] for row in rows]}, geometry=gpd.points_from_xy([row[5] for row in rows],[row[4] for row in rows]), crs=4326)
    matches = {row[0]:[] for row in rows}
    domains = {key:{'min':float('inf'),'max':float('-inf')} for key in KEYS}
    for state in manifest['states']:
        source = json.loads(gzip.decompress((DEST/'setores'/f"{state['uf']}.geojson.gz").read_bytes()))
        polygons = gpd.GeoDataFrame.from_features(source['features'], crs=4326)
        for key in KEYS:
            valid = polygons[key].dropna()
            if len(valid):
                domains[key]['min'] = min(domains[key]['min'],float(valid.min()))
                domains[key]['max'] = max(domains[key]['max'],float(valid.max()))
        joined = gpd.sjoin(points, polygons[['CD_SETOR',*KEYS,'geometry']], how='inner', predicate='within')
        for record in joined.itertuples():
            values = [getattr(record,key) for key in KEYS]
            matches[record.id].append([record.CD_SETOR,*[None if value is None or not np.isfinite(value) else float(value) for value in values]])
        print(state['uf'],len(joined),'associações',flush=True)
        del source, polygons, joined
        gc.collect()
    lookup = {code:values[0] if len(values)==1 else None for code,values in matches.items()}
    report = {'mapeadas':len(rows),'associadas':sum(value is not None for value in lookup.values()),
              'sem_setor':sum(not values for values in matches.values()),'ambiguas':sum(len(values)>1 for values in matches.values())}
    result = {'variables':KEYS,'domains':domains,'schools':lookup,'report':report,
              'method':'Ponto estritamente dentro de um único polígono da malha de exibição (simplificada em até 12 m); sem aproximação por vizinhança.'}
    (DEST/'escolas_setores.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    print(json.dumps(report),flush=True)


if __name__ == '__main__':
    preparar()

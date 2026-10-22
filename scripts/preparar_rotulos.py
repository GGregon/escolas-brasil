"""Gera pontos leves de rotulagem a partir dos limites oficiais de 2022."""
import gzip
import json
from pathlib import Path

from shapely.geometry import shape

DEST = Path(__file__).resolve().parents[1] / 'frontend/public/data'


def preparar():
    features = []
    for kind in ('estados', 'municipios'):
        source = json.loads(gzip.decompress((DEST / f'{kind}.geojson.gz').read_bytes()))
        for feature in source['features']:
            geometry = shape(feature['geometry'])
            # Ilhas e partes desconectadas não devem receber rótulos duplicados.
            main = max(geometry.geoms, key=lambda part: part.area) if geometry.geom_type == 'MultiPolygon' else geometry
            point = main.representative_point()
            assert main.covers(point)
            props = feature['properties']
            features.append({
                'type': 'Feature',
                'properties': {**props, 'kind': kind, 'area': round(main.area, 6),
                               'bounds': [round(value, 6) for value in geometry.bounds]},
                'geometry': {'type': 'Point', 'coordinates': [round(point.x, 6), round(point.y, 6)]},
            })
    assert len(features) == 5597
    (DEST / 'rotulos.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('Rótulos preparados: 27 estados e 5.570 municípios')


if __name__ == '__main__':
    preparar()

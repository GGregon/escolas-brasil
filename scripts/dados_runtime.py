"""Lista explícita dos arquivos necessários para executar o mapa."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'frontend' / 'public' / 'data'


def arquivos():
    manifest = json.loads((DATA / 'manifest.json').read_text(encoding='utf-8'))
    return ['manifest.json', 'escolas.json', 'escolas_setores.json', 'rotulos.geojson',
            'tiles/estados.pmtiles', 'tiles/municipios.pmtiles',
            'tiles/escolas-v2.pmtiles', 'tiles/escolas-inep-v2.pmtiles',
            *[f'tiles/setores-{state["uf"]}.pmtiles' for state in manifest['states']]]

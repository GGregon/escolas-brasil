"""Associa QT_MAT_BAS da tabela de matrículas de 2025 por código INEP."""
import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def preparar(csv):
    table = pd.read_csv(csv, sep=';', encoding='cp1252', usecols=['NU_ANO_CENSO', 'CO_ENTIDADE', 'QT_MAT_BAS'], dtype={'CO_ENTIDADE': 'string'})
    assert table.CO_ENTIDADE.is_unique and table.NU_ANO_CENSO.eq(2025).all()
    assert table.QT_MAT_BAS.notna().all() and table.QT_MAT_BAS.ge(0).all()
    assert table.QT_MAT_BAS.eq(table.QT_MAT_BAS.round()).all()
    counts = table.set_index('CO_ENTIDADE').QT_MAT_BAS
    asset = ROOT / 'frontend/public/data/escolas.json'
    data = json.loads(asset.read_text(encoding='utf-8'))
    for row in data['registros']:
        row[10:] = [int(counts[row[0]]) if row[0] in counts else None]
    data['matriculas'] = {'ano': 2025, 'variavel': 'QT_MAT_BAS', 'descricao': 'Matrículas da educação básica; não corresponde a alunos únicos',
                          'total_mapeado': sum(row[10] or 0 for row in data['registros']),
                          'escolas_sem_total': sum(row[10] is None for row in data['registros'])}
    asset.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    with csv.open('rb') as file:
        digest = hashlib.file_digest(file, 'sha256').hexdigest()
    report = {**data['matriculas'], 'escolas': len(data['registros']), 'arquivo': str(csv), 'sha256': digest,
              'minimo': min(row[10] for row in data['registros'] if row[10] is not None), 'maximo': max(row[10] for row in data['registros'] if row[10] is not None)}
    (ROOT / 'dados/processados/validacao_matriculas_2025.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', type=Path, required=True)
    preparar(parser.parse_args().csv)

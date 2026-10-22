"""Tabela nacional de renda do responsável, Censo 2022; sem geometrias."""
from __future__ import annotations

import io
import json
import hashlib
import shutil
import struct
import sys
import zlib
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if (ROOT / '.deps').exists():
    sys.path.insert(0, str(ROOT / '.deps'))
RAW = ROOT / 'dados' / 'brutos'
OUT = ROOT / 'dados' / 'processados'
BASE = 'https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios_Rendimento_do_Responsavel/'
RENDA_URL = BASE + 'Agregados_por_setores_renda_responsavel_BR_20260508_csv.zip'
DIC_URL = BASE + 'dicionario_de_dados_renda_responsavel_20260508.xlsx'
MALHA_URL = 'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/setores/shp/BR/BR_setores_CD2022.zip'


class RemoteZip(io.RawIOBase):
    """Leitura por intervalos HTTP: transfere somente o DBF, sem os polígonos."""
    def __init__(self, url):
        self.url = url
        with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=120) as r:
            self.size = int(r.headers['Content-Length'])
        self.pos = 0

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def tell(self):
        return self.pos

    def seekable(self):
        return True

    def read(self, n=-1):
        n = self.size - self.pos if n < 0 else min(n, self.size - self.pos)
        if n <= 0:
            return b''
        end = self.pos + n - 1
        req = urllib.request.Request(self.url, headers={'Range': f'bytes={self.pos}-{end}'})
        with urllib.request.urlopen(req, timeout=180) as r:
            if r.status != 206 or not r.headers.get('Content-Range', '').startswith(f'bytes {self.pos}-{end}/'):
                raise RuntimeError('Servidor não confirmou Range HTTP. Use o ZIP nacional local em dados/brutos.')
            data = r.read()
        if len(data) != n:
            raise IOError('Intervalo HTTP incompleto')
        self.pos += len(data)
        return data


def download(url):
    path = RAW / url.rsplit('/', 1)[-1]
    if not path.exists():
        tmp = path.with_suffix(path.suffix + '.part')
        with urllib.request.urlopen(url, timeout=180) as src, tmp.open('wb') as dst:
            shutil.copyfileobj(src, dst)
        tmp.replace(path)
    return path


def obter_dbf():
    path = RAW / 'BR_setores_CD2022.dbf'
    if not path.exists():
        local = RAW / 'BR_setores_CD2022.zip'
        source = local if local.exists() else RemoteZip(MALHA_URL)
        with ZipFile(source) as z:
            members = [x for x in z.namelist() if x.lower().endswith('.dbf')]
            if len(members) != 1:
                raise ValueError(f'DBF nacional ambíguo: {members}')
            print('Extraindo atributos da malha:', members[0], flush=True)
            tmp = path.with_suffix('.dbf.part')
            info = z.getinfo(members[0])
            print('ZIP nacional (bytes):', source.size if isinstance(source, RemoteZip) else local.stat().st_size,
                  'DBF comprimido (bytes):', info.compress_size, 'método:', info.compress_type, flush=True)
            if info.compress_type == 9:
                import inflate64
                # Deflate64 não é suportado por zipfile, mas seu índice é legível.
                with local.open('rb') if local.exists() else RemoteZip(MALHA_URL) as stream:
                    stream.seek(info.header_offset)
                    header = stream.read(30)
                    if header[:4] != b'PK\x03\x04':
                        raise ValueError('Cabeçalho ZIP inválido')
                    name_len, extra_len = struct.unpack_from('<HH', header, 26)
                    stream.seek(info.header_offset + 30 + name_len + extra_len)
                    compressed = stream.read(info.compress_size)
                data = inflate64.Inflater().inflate(compressed)
                if len(data) != info.file_size or zlib.crc32(data) != info.CRC:
                    raise ValueError('Tamanho/CRC do DBF inválido')
                tmp.write_bytes(data)
            else:
                with z.open(members[0]) as src, tmp.open('wb') as dst:
                    shutil.copyfileobj(src, dst)
            tmp.replace(path)
    return path


def ler_malha(path):
    # DBF dBASE III: lê apenas atributos, sem instalar bibliotecas geoespaciais.
    with path.open('rb') as f:
        header = f.read(32)
        count, header_len, record_len = struct.unpack_from('<IHH', header, 4)
        fields = []
        offset = 1
        while f.tell() < header_len - 1:
            desc = f.read(32)
            name = desc[:11].split(b'\0')[0].decode('ascii')
            length = desc[16]
            fields.append((name, offset, length))
            offset += length
        print('Campos da malha:', [x[0] for x in fields], flush=True)
        selected = [x for x in fields if x[0] in {'CD_SETOR', 'CD_UF', 'NM_UF', 'CD_MUN', 'NM_MUN', 'SITUACAO', 'CD_SIT', 'CD_TIPO', 'AREA_KM2'}]
        f.seek(header_len)
        rows = []
        for _ in range(count):
            record = f.read(record_len)
            if len(record) != record_len:
                raise ValueError('DBF truncado')
            if record[:1] != b' ':
                raise ValueError('Registro DBF excluído ou inválido')
            rows.append([record[o:o+n].decode('utf-8').strip() for _, o, n in selected])
    df = pd.DataFrame(rows, columns=[x[0] for x in selected], dtype='string')
    if 'AREA_KM2' in df:
        df['AREA_KM2'] = pd.to_numeric(df['AREA_KM2'], errors='raise').astype('Float64')
    return df


def validar_chave(df, origem):
    if not df['CD_SETOR'].str.fullmatch(r'\d{15}').fillna(False).all():
        raise ValueError(f'Código de setor inválido: {origem}')
    if df['CD_SETOR'].duplicated().any():
        raise ValueError(f'Setores duplicados: {origem}')


def gerar():
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    renda_path = download(RENDA_URL)
    download(DIC_URL)
    dbf_path = obter_dbf()
    malha = ler_malha(dbf_path)
    renda = pd.read_csv(renda_path, compression='zip', sep=';', dtype='string', keep_default_na=False)
    validar_chave(malha, 'malha')
    validar_chave(renda, 'renda')
    variables = [f'V0600{i}' for i in range(1, 7)]
    if list(renda.columns) != ['CD_SETOR'] + variables:
        raise ValueError('Esquema de renda diferente do esperado')
    extra = set(renda.CD_SETOR) - set(malha.CD_SETOR)
    if extra:
        raise ValueError(f'{len(extra)} setores da renda ausentes na malha')
    for col in variables:
        raw = renda[col].str.strip()
        # Preserva o símbolo original separadamente; desconhecidos causam erro.
        renda[col + '_simbolo'] = raw.where(raw.isin(['X', '.', '-', '...']) | raw.eq(''), pd.NA)
        numeric = raw.mask(raw.isin(['X', '.', '-', '...', '']))
        renda[col] = pd.to_numeric(numeric, errors='raise').astype('Float64')
    for col in ['V06001', 'V06002']:
        renda[col] = renda[col].astype('Int64')
    table = malha.merge(renda, on='CD_SETOR', how='left', validate='one_to_one', indicator=True)
    table['presente_arquivo_renda'] = table.pop('_merge').eq('both')
    table['status_renda_media'] = 'disponivel'
    table.loc[table.V06004.isna(), 'status_renda_media'] = 'sem_valor_publicado'
    table.loc[table.V06004_simbolo.eq('X').fillna(False), 'status_renda_media'] = 'suprimido'
    table.loc[~table.presente_arquivo_renda, 'status_renda_media'] = 'ausente_arquivo_renda'
    table['ano_censo'] = 2022
    table = table.sort_values('CD_SETOR').reset_index(drop=True)
    if len(table) != len(malha) or table.CD_SETOR.str[:2].nunique() != 27:
        raise ValueError('Cobertura nacional inconsistente')
    output = OUT / 'renda_responsavel_setor_2022_BR.csv'
    tmp = output.with_suffix('.csv.part')
    table.to_csv(tmp, index=False, encoding='utf-8', lineterminator='\n')
    tmp.replace(output)
    report = {
        'gerado_em_utc': datetime.now(timezone.utc).isoformat(),
        'ano_censo': 2022,
        'versao_renda': '2026-05-08',
        'fontes': {'renda': RENDA_URL, 'dicionario': DIC_URL, 'malha': MALHA_URL},
        'linhas_malha': len(malha), 'linhas_renda': len(renda), 'linhas_saida': len(table),
        'ufs': int(table.CD_SETOR.str[:2].nunique()),
        'status_renda_media': {str(k): int(v) for k, v in table.status_renda_media.value_counts().items()},
        'nulos_por_variavel': {c: int(table[c].isna().sum()) for c in variables},
        'simbolos_originais': {c: {str(k): int(v) for k,v in renda[c+'_simbolo'].dropna().value_counts().items()} for c in variables},
        'sha256_arquivos': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [renda_path, dbf_path, output]},
        'linhas_por_uf': {str(k): int(v) for k,v in table.groupby(table.CD_SETOR.str[:2]).size().items()},
    }
    (OUT / 'validacao.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return table


if __name__ == '__main__':
    gerar()

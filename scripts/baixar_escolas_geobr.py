"""Baixa o snapshot de escolas de 2025 publicado pelo Ipea/geobr."""
import json
import urllib.request

from gerar_tabela import RAW, download


def obter():
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = RAW / 'geobr_escolas_2025_fonte.json'
    if manifest.exists():
        metadata = json.loads(manifest.read_text(encoding='utf-8'))
    else:
        url = 'https://api.github.com/repos/ipea/geobr_prep_data/releases/tags/v2.0.0'
        req = urllib.request.Request(url, headers={'User-Agent': 'renda-setor-censitario'})
        with urllib.request.urlopen(req, timeout=120) as src:
            release = json.load(src)
        assets = [a for a in release['assets'] if a['name'].startswith('schools_2025') and a['name'].endswith('.parquet') and 'simplified' not in a['name']]
        if len(assets) != 1:
            raise ValueError(f'Snapshot de 2025 ambíguo: {[a["name"] for a in assets]}')
        asset = assets[0]
        metadata = {'release': release['tag_name'], 'release_url': release['html_url'],
                    'arquivo': asset['name'], 'url': asset['browser_download_url'],
                    'bytes': asset['size'], 'digest': asset.get('digest'),
                    'atualizado_em': asset['updated_at'],
                    'metodo_coordenadas': 'https://github.com/ipea/geobr/blob/master/r-package/R/read_schools.R'}
        manifest.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(metadata, ensure_ascii=False, indent=2), flush=True)
    path = download(metadata['url'])
    if path.stat().st_size != metadata['bytes']:
        raise ValueError('Tamanho do snapshot diferente do manifesto')
    import hashlib
    with path.open('rb') as f:
        digest = hashlib.file_digest(f, 'sha256').hexdigest()
    if metadata.get('digest') and metadata['digest'] != 'sha256:' + digest:
        raise ValueError('SHA-256 diferente do manifesto da release')
    print(path, digest)
    return path, metadata


if __name__ == '__main__':
    obter()

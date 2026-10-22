"""Gera pacote de execução e catálogo de integridade, sem fontes ou caches."""
import hashlib
import json
from zipfile import ZipFile, ZIP_DEFLATED
from dados_runtime import ROOT, DATA, arquivos


def preparar():
    target = ROOT / 'artifacts' / 'dados-mapa-v1.zip'
    target.parent.mkdir(exist_ok=True)
    catalog = []
    with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=1) as archive:
        for name in arquivos():
            source = DATA / name
            with source.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            catalog.append({'path': name, 'bytes': source.stat().st_size, 'sha256': digest})
            archive.write(source, name)
    with target.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    metadata = {'repository': 'GGregon/escolas-brasil', 'tag': 'dados-v1',
                'asset': target.name, 'bytes': target.stat().st_size,
                'sha256': digest, 'files': catalog}
    (ROOT / 'docs' / 'dados-release.json').write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{target.name}: {target.stat().st_size:,} bytes; {len(catalog)} arquivos; SHA-256 {digest}')


if __name__ == '__main__':
    preparar()

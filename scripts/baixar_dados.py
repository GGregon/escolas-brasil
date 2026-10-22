"""Instala dados preparados; somente biblioteca padrão Python 3.11+."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.request
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'frontend' / 'public' / 'data'


class RedirectSeguro(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None:
            redirected.remove_header('Authorization')
        return redirected


def credencial():
    token = os.environ.get('GITHUB_TOKEN')
    if token:
        return token
    try:
        result = subprocess.run(['git', 'credential', 'fill'],
            input='protocol=https\nhost=github.com\n\n', text=True,
            capture_output=True, timeout=20,
            env={**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'GCM_INTERACTIVE': 'never'})
        for line in result.stdout.splitlines() if result.returncode == 0 else []:
            if line.startswith('password='):
                return line.partition('=')[2]
    except (OSError, subprocess.TimeoutExpired):
        pass
    return None


def baixar(config, target):
    token = credencial()
    headers = {'User-Agent': 'escolas-brasil', 'Accept': 'application/vnd.github+json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    opener = urllib.request.build_opener(RedirectSeguro())
    api = f'https://api.github.com/repos/{config["repository"]}/releases/tags/{config["tag"]}'
    try:
        with opener.open(urllib.request.Request(api, headers=headers), timeout=60) as response:
            release = json.load(response)
        assets = [a for a in release['assets'] if a['name'] == config['asset']]
        if len(assets) != 1 or assets[0]['size'] != config['bytes']:
            raise ValueError('Pacote ausente ou com tamanho inesperado na release.')
        headers['Accept'] = 'application/octet-stream'
        print('Baixando pacote de dados. Isso pode levar alguns minutos.', flush=True)
        with opener.open(urllib.request.Request(assets[0]['url'], headers=headers), timeout=180) as response, target.open('wb') as dst:
            total = 0
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > config['bytes']:
                    raise ValueError('Download maior que o tamanho esperado.')
                dst.write(chunk)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'GitHub retornou HTTP {error.code}. Confira seu acesso ao repositório e à release. '
                           'Para repositórios privados, autentique o Git por HTTPS, use GITHUB_TOKEN '
                           'somente neste processo, ou use --arquivo com o ZIP recebido do mantenedor.') from None


def instalar(archive_path, config):
    with archive_path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    if archive_path.stat().st_size != config['bytes'] or digest != config['sha256']:
        raise ValueError('Integridade do pacote inválida: tamanho ou SHA-256 não confere.')
    expected = {item['path']: item for item in config['files']}
    with ZipFile(archive_path) as archive, tempfile.TemporaryDirectory(prefix='escolas-dados-') as staging:
        names = archive.namelist()
        if len(names) != len(expected) or set(names) != set(expected):
            raise ValueError('O ZIP não corresponde à lista de arquivos esperados.')
        for name in names:
            parts = PurePosixPath(name)
            if parts.is_absolute() or '..' in parts.parts or '\\' in name or ':' in name:
                raise ValueError('Caminho inválido no pacote.')
            info, item = archive.getinfo(name), expected[name]
            if info.file_size != item['bytes']:
                raise ValueError(f'Tamanho inválido: {name}')
            target = Path(staging) / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as src, target.open('wb') as dst:
                shutil.copyfileobj(src, dst)
            with target.open('rb') as stream:
                if hashlib.file_digest(stream, 'sha256').hexdigest() != item['sha256']:
                    raise ValueError(f'SHA-256 inválido: {name}')
        # Nenhum arquivo instalado antes de validar todo o pacote.
        for name in names:
            target = DATA / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(Path(staging) / name, target.with_suffix(target.suffix + '.part'))
            target.with_suffix(target.suffix + '.part').replace(target)
    print(f'Dados instalados e verificados: {len(expected)} arquivos.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--arquivo', type=Path, help='Instalar ZIP local, sem acessar o GitHub')
    args = parser.parse_args()
    config = json.loads((ROOT / 'docs' / 'dados-release.json').read_text(encoding='utf-8'))
    if args.arquivo:
        instalar(args.arquivo, config)
    else:
        with tempfile.TemporaryDirectory(prefix='escolas-download-') as temporary:
            path = Path(temporary) / config['asset']
            baixar(config, path)
            instalar(path, config)


if __name__ == '__main__':
    main()

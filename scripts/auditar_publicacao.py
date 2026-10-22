"""Verifica somente os arquivos publicáveis, sem imprimir possíveis segredos."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    'chave privada': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'token GitHub': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,})\b'),
    'chave AWS': re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'chave Google': re.compile(r'\bAIza[A-Za-z0-9_-]{35}\b'),
    'caminho pessoal Windows': re.compile(r'[A-Z]:[\\/]+Users[\\/]+[^\\/\s]+', re.I),
    'caminho pessoal Unix': re.compile(r'/(?:Users|home)/[a-zA-Z0-9_.-]+/'),
    'credencial em URL': re.compile(r'https?://[^\s/"\x27:]+:[^\s/@"\x27]+@'),
}


def main():
    result = subprocess.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
                            cwd=ROOT, check=True, capture_output=True)
    names = sorted(set(result.stdout.decode('utf-8').split('\0')) - {''})
    problems = []
    for name in names:
        path = ROOT / name
        if not path.is_file():
            continue
        if path.stat().st_size > 5 * 1024 * 1024:
            problems.append((name, 'arquivo maior que 5 MiB no código-fonte'))
        if name.startswith(('dados/', 'frontend/public/data/', 'artifacts/')) and not name.endswith('.gitkeep'):
            problems.append((name, 'dados gerados não devem entrar no Git'))
        if path.name.startswith('.env') and path.name != '.env.example':
            problems.append((name, 'arquivo de ambiente'))
        text = path.read_text(encoding='utf-8', errors='replace')
        for label, pattern in PATTERNS.items():
            if pattern.search(text):
                problems.append((name, label))
    for name, label in problems:
        print(f'{name}: {label}')
    print(f'{len(names)} arquivos inspecionados; {len(problems)} ocorrências.')
    return bool(problems)


if __name__ == '__main__':
    sys.exit(main())

"""Valida integridade, caminhos e tratamento de credenciais do instalador."""
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.request
from zipfile import ZipFile

import baixar_dados


class InstalacaoTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.data = self.root / 'data'
        self.zip = self.root / 'dados.zip'

    def package(self, entries):
        with ZipFile(self.zip, 'w') as archive:
            for name, body in entries:
                archive.writestr(name, body)
        content = self.zip.read_bytes()
        return {'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest(),
                'files': [{'path': name, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
                          for name, body in entries]}

    def test_instala_arquivos_verificados(self):
        config = self.package([('manifest.json', b'{}'), ('tiles/exemplo.pmtiles', b'tile')])
        with patch.object(baixar_dados, 'DATA', self.data):
            baixar_dados.instalar(self.zip, config)
        self.assertEqual((self.data / 'tiles/exemplo.pmtiles').read_bytes(), b'tile')

    def test_rejeita_zip_alterado_sem_instalar(self):
        config = self.package([('manifest.json', b'{}')])
        self.zip.write_bytes(self.zip.read_bytes() + b'alterado')
        with patch.object(baixar_dados, 'DATA', self.data), self.assertRaises(ValueError):
            baixar_dados.instalar(self.zip, config)
        self.assertFalse(self.data.exists())

    def test_rejeita_caminho_fora_do_destino(self):
        config = self.package([('../fora.txt', b'nao instalar')])
        with patch.object(baixar_dados, 'DATA', self.data), self.assertRaises(ValueError):
            baixar_dados.instalar(self.zip, config)
        self.assertFalse((self.root / 'fora.txt').exists())

    def test_rejeita_hash_individual_sem_alterar_dados_existentes(self):
        config = self.package([('manifest.json', b'novo')])
        config['files'][0]['sha256'] = '0' * 64
        self.data.mkdir()
        target = self.data / 'manifest.json'
        target.write_bytes(b'anterior')
        with patch.object(baixar_dados, 'DATA', self.data), self.assertRaises(ValueError):
            baixar_dados.instalar(self.zip, config)
        self.assertEqual(target.read_bytes(), b'anterior')

    def test_redirecionamento_nao_envia_credencial(self):
        request = urllib.request.Request('https://api.github.com/exemplo',
                                         headers={'Authorization': 'Bearer exemplo'})
        redirected = baixar_dados.RedirectSeguro().redirect_request(
            request, None, 302, 'Found', {}, 'https://release-assets.githubusercontent.com/exemplo')
        self.assertIsNone(redirected.get_header('Authorization'))


if __name__ == '__main__':
    unittest.main()

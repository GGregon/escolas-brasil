"""Obtém a malha oficial completa e extrai os componentes do shapefile."""
import struct
import zlib
from zipfile import ZipFile

from gerar_tabela import RAW, MALHA_URL, download


def preparar():
    import inflate64
    RAW.mkdir(exist_ok=True, parents=True)
    shp = RAW / 'BR_setores_CD2022.shp'
    if all(shp.with_suffix(ext).exists() for ext in ['.shp','.shx','.prj','.dbf','.cpg']):
        return shp
    print('Baixando malha nacional (~774 MB)...', flush=True)
    path = download(MALHA_URL)
    with ZipFile(path) as z:
        for info in z.infolist():
            if not info.filename.lower().endswith(('.shp', '.shx', '.prj', '.cpg', '.dbf')):
                continue
            target = RAW / info.filename.rsplit('/', 1)[-1]
            if target.exists() and target.stat().st_size == info.file_size:
                continue
            print('Extraindo', target.name, info.file_size, flush=True)
            tmp = target.with_suffix(target.suffix + '.part')
            crc = 0
            size = 0
            with path.open('rb') as src, tmp.open('wb') as dst:
                if info.compress_type == 9:
                    src.seek(info.header_offset)
                    header = src.read(30)
                    name_len, extra_len = struct.unpack_from('<HH', header, 26)
                    src.seek(info.header_offset + 30 + name_len + extra_len)
                    remaining = info.compress_size
                    inflater = inflate64.Inflater()
                    while remaining:
                        chunk = src.read(min(1024 * 1024, remaining))
                        if not chunk:
                            raise IOError('ZIP truncado')
                        remaining -= len(chunk)
                        result = inflater.inflate(chunk)
                        dst.write(result)
                        size += len(result)
                        crc = zlib.crc32(result, crc)
                else:
                    with z.open(info) as entry:
                        while chunk := entry.read(1024 * 1024):
                            dst.write(chunk)
                            size += len(chunk)
                            crc = zlib.crc32(chunk, crc)
            if size != info.file_size or crc != info.CRC:
                raise ValueError(f'Integridade inválida: {target.name}')
            tmp.replace(target)
    return shp


if __name__ == '__main__':
    print(preparar())

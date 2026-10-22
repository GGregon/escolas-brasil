"""Recebe tiles MVT pela entrada padrão e grava um arquivo PMTiles atômico."""
import json
import os
from pathlib import Path
import struct
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '.deps'))
from pmtiles.writer import write
from pmtiles.tile import Compression, TileType, zxy_to_tileid

target = Path(sys.argv[1])
metadata = json.loads(sys.argv[2])
temporary = target.with_suffix('.part')
target.parent.mkdir(parents=True, exist_ok=True)

def read_exact(size):
    result = bytearray()
    while len(result) < size:
        chunk = sys.stdin.buffer.read(size - len(result))
        if not chunk:
            raise EOFError('Fluxo de tiles incompleto')
        result.extend(chunk)
    return bytes(result)

try:
    with write(temporary) as writer:
        while True:
            header = sys.stdin.buffer.read(16)
            if not header:
                break
            if len(header) != 16:
                raise EOFError('Cabeçalho incompleto')
            size, z, x, y = struct.unpack('<IIII', header)
            writer.write_tile(zxy_to_tileid(z, x, y), read_exact(size))
        writer.finalize({
            'tile_compression': Compression.GZIP, 'tile_type': TileType.MVT,
            'min_lon_e7': -740000000, 'min_lat_e7': -340000000,
            'max_lon_e7': -280000000, 'max_lat_e7': 60000000,
            'center_zoom': 4, 'center_lon_e7': -510000000, 'center_lat_e7': -150000000,
        }, metadata)
    os.replace(temporary, target)
finally:
    temporary.unlink(missing_ok=True)

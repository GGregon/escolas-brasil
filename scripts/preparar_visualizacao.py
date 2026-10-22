"""Prepara os assets locais do aplicativo React, incluindo os seis indicadores."""
from __future__ import annotations

import gzip
import hashlib
import json
import struct
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.deps'))

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import shapely
from pyproj import Transformer

from gerar_tabela import OUT,RAW

DEST=ROOT/'frontend/public/data'
PALETTE=['#d9f0a3','#addd8e','#78c6a3','#41b6c4','#2c7fb8','#253494']
MISSING='#ffffff'
VARIABLES={
    'V06001':{'label':'Pessoas responsáveis','description':'Pessoas responsáveis por domicílios particulares permanentes ocupados','unit':'pessoas','breaks':[50,100,200,400,800]},
    'V06002':{'label':'Moradores','description':'Moradores em domicílios particulares permanentes ocupados','unit':'moradores','breaks':[100,250,500,1000,2000]},
    'V06003':{'label':'Variância de moradores','description':'Variância do número de moradores nesses domicílios','unit':'moradores²','breaks':[.5,1,2,3,5]},
    'V06004':{'label':'Renda média mensal','description':'Rendimento nominal médio mensal dos responsáveis com rendimento','unit':'R$','breaks':[1212,2424,4848,9696,19392]},
    'V06005':{'label':'Variância do rendimento','description':'Variância do rendimento nominal mensal dos responsáveis com rendimento','unit':'R$²','breaks':[100000,500000,1000000,5000000,10000000]},
    'V06006':{'label':'Renda mediana mensal','description':'Rendimento nominal mediano mensal dos responsáveis com rendimento','unit':'R$','breaks':[1212,2424,4848,9696,19392]},
}


def hash_file(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f,'sha256').hexdigest()


def write_gzip(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(gzip.compress(json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode(),compresslevel=6,mtime=0))


def fids_by_state():
    groups={}
    with (RAW/'BR_setores_CD2022.dbf').open('rb') as f:
        header=f.read(32)
        n,hlen,rlen=struct.unpack_from('<IHH',header,4)
        offset=1
        key=None
        while f.tell()<hlen-1:
            d=f.read(32)
            if d[:11].split(b'\0')[0]==b'CD_SETOR':
                key=(offset,d[16])
            offset+=d[16]
        if key is None:
            raise ValueError('Malha sem CD_SETOR')
        f.seek(hlen)
        for fid in range(n):
            record=f.read(rlen)
            code=record[key[0]:key[0]+key[1]].decode().strip()
            groups.setdefault(code[:2],[]).append(fid)
    return groups


def geometry_for_state(uf,fids):
    cached=DEST/'setores'/f'{uf}.geojson.gz'
    if cached.exists():
        features=json.loads(gzip.decompress(cached.read_bytes()))['features']
        return [(f['properties']['CD_SETOR'],f['geometry']) for f in features]
    frame=pyogrio.read_dataframe(RAW/'BR_setores_CD2022.shp',columns=['CD_SETOR'],fids=fids)
    simplified=frame.to_crs(3857).geometry.simplify(12,preserve_topology=True)
    geoms=gpd.GeoSeries(simplified,crs=3857).to_crs(4326)
    geoms=shapely.set_precision(geoms.array,.000001)
    if shapely.is_empty(geoms).any():
        raise ValueError('Simplificação eliminou setores')
    return [(str(code),json.loads(shapely.to_geojson(geom))) for code,geom in zip(frame.CD_SETOR,geoms)]


def boundaries():
    manifest=json.loads((RAW/'geobr_limites_2022_fontes.json').read_text(encoding='utf-8'))
    counts={}
    for kind,meta in manifest.items():
        frame=gpd.read_parquet(RAW/meta['arquivo']).to_crs(4326)
        key='code_state' if kind=='estados' else 'code_muni'
        name='name_state' if kind=='estados' else 'name_muni'
        if kind=='municipios':
            # Os dois polígonos de lagoas não são municípios brasileiros.
            lakes=frame[key].astype('Int64').isin([4300001,4300002])
            print('Áreas lacustres fora da camada municipal:',frame.loc[lakes,name].tolist(),flush=True)
            frame=frame.loc[~lakes].reset_index(drop=True)
        assert frame[key].is_unique
        geometry=frame.geometry.simplify(.0005 if kind=='estados' else .00025,preserve_topology=True)
        rows=[]
        for i,geom in enumerate(geometry):
            r=frame.iloc[i]
            props={'code':str(int(r[key])),'name':str(r[name]),'uf':str(r.get('abbrev_state',''))}
            rows.append({'type':'Feature','id':props['code'],'properties':props,'geometry':json.loads(shapely.to_geojson(geom))})
        write_gzip(DEST/f'{kind}.geojson.gz',{'type':'FeatureCollection','features':rows})
        counts[kind]=len(rows)
        print(kind,len(rows),flush=True)
    assert counts['estados']==27 and counts['municipios']==5570
    return counts


def preparar():
    DEST.mkdir(parents=True,exist_ok=True)
    table_path=OUT/'renda_responsavel_setor_2022_BR.csv'
    table=pd.read_csv(table_path,dtype={'CD_SETOR':'string','CD_UF':'string','CD_MUN':'string'}).set_index('CD_SETOR')
    assert table.index.is_unique
    with (RAW/'BR_setores_CD2022.shp').open('rb') as f:
        f.seek(36)
        xmin,ymin,xmax,ymax=struct.unpack('<4d',f.read(32))
    transform=Transformer.from_crs(4326,3857,always_xy=True)
    left,bottom=transform.transform(xmin-.15,ymin-.15)
    right,top=transform.transform(xmax+.15,ymax+.15)
    inverse=Transformer.from_crs(3857,4326,always_xy=True)
    west,south=inverse.transform(left,bottom)
    east,north=inverse.transform(right,top)
    states=[]
    seen=set()
    groups=fids_by_state()
    for uf,fids in sorted(groups.items()):
        print('Preparando indicadores e geometrias:',uf,flush=True)
        rows=geometry_for_state(uf,fids)
        codes=[r[0] for r in rows]
        assert len(codes)==len(fids) and len(set(codes))==len(codes)
        assert all(c.startswith(uf) for c in codes) and not (set(codes)&seen)
        seen.update(codes)
        attrs=table.loc[codes]
        geoms=shapely.from_geojson([json.dumps(r[1]) for r in rows])
        features=[]
        values=attrs[list(VARIABLES)].to_numpy(dtype=float)
        all_bounds=shapely.total_bounds(geoms).tolist()
        for index,((code,geometry),row) in enumerate(zip(rows,attrs.itertuples())):
            props={'CD_SETOR':code,'NM_MUN':'Município não informado' if pd.isna(row.NM_MUN) else row.NM_MUN,
                   'sigilo':bool(row.V06001_simbolo=='X')}
            for j,(key,var) in enumerate(VARIABLES.items()):
                val=values[index,j]
                props[key]=None if np.isnan(val) else float(val)
            features.append({'type':'Feature','id':code,'properties':props,'geometry':geometry})
        write_gzip(DEST/'setores'/f'{uf}.geojson.gz',{'type':'FeatureCollection','features':features})
        states.append({'uf':uf,'bounds':all_bounds,'count':len(rows)})
        del rows,geoms,features,attrs,values
    assert seen==set(table.index) and len(seen)==468099
    counts=boundaries()
    for key,var in VARIABLES.items():
        var['available']=int(table[key].notna().sum())
    schools=json.loads((DEST/'escolas.json').read_text(encoding='utf-8'))
    config={'schemaVersion':1,'year':2022,'variables':VARIABLES,'palette':PALETTE,'missing':MISSING,
            'imageCoordinates':[[west,north],[east,north],[east,south],[west,south]],
            'bounds':[[west,south],[east,north]],'states':states,'total':len(seen),
            'schools':schools['meta'],'boundaries':counts,'sourceTableSha256':hash_file(table_path)}
    (DEST/'manifest.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
    from preparar_rotulos import preparar as preparar_rotulos
    preparar_rotulos()
    from preparar_filtro_setores import preparar as preparar_filtro_setores
    preparar_filtro_setores()
    print('Assets prontos:',len(seen),'setores;',counts,flush=True)


if __name__=='__main__':
    preparar()

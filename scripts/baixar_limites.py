"""Baixa limites de estados e municípios de 2022 do Ipea/geobr."""
import hashlib
import json
import urllib.request

from gerar_tabela import RAW, download


def obter():
    manifest = RAW/'geobr_limites_2022_fontes.json'
    if manifest.exists():
        sources = json.loads(manifest.read_text(encoding='utf-8'))
    else:
        req = urllib.request.Request('https://api.github.com/repos/ipea/geobr_prep_data/releases/tags/v2.0.0',headers={'User-Agent':'renda-setor-censitario'})
        with urllib.request.urlopen(req,timeout=120) as src:
            release=json.load(src)
        sources={}
        for kind,prefixes in {'estados':['states_2022'], 'municipios':['municipalities_2022','municipality_2022']}.items():
            candidates=[a for a in release['assets'] if any(a['name'].startswith(p) for p in prefixes) and a['name'].endswith('.parquet')]
            simplified=[a for a in candidates if 'simplified' in a['name']]
            candidates=simplified or candidates
            if len(candidates)!=1:
                raise ValueError(f'Limites {kind} ambíguos: {[a["name"] for a in candidates]}')
            a=candidates[0]
            sources[kind]={'arquivo':a['name'],'url':a['browser_download_url'],'bytes':a['size'],'digest':a.get('digest'),'release':release['tag_name'],'ano':2022}
        manifest.write_text(json.dumps(sources,ensure_ascii=False,indent=2),encoding='utf-8')
    for kind,source in sources.items():
        print(kind,source['arquivo'],source['bytes'],flush=True)
        path=download(source['url'])
        with path.open('rb') as f:
            digest='sha256:'+hashlib.file_digest(f,'sha256').hexdigest()
        if path.stat().st_size!=source['bytes'] or (source.get('digest') and digest!=source['digest']):
            raise ValueError(f'Integridade inválida: {kind}')
    return sources


if __name__=='__main__':
    obter()

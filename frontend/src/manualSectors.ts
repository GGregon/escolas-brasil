import { PMTiles } from 'pmtiles'
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'
import type { MultiPolygon, Polygon, Position } from 'geojson'
import { asset } from './data'
import { VARIABLE_KEYS, type Manifest, type SchoolRow, type SectorRow } from './types'

type SectorShape = {geometry: Polygon | MultiPolygon; sector: SectorRow}
const archives = new Map<string,PMTiles>()
const tiles = new Map<string,Promise<SectorShape[]>>()
const locations = new Map<string,Promise<SectorRow|null>>()

function ringRelation(point: Position, ring: Position[]): -1 | 0 | 1 {
  const [x,y] = point
  let inside = false
  for (let i=0,j=ring.length-1; i<ring.length; j=i++) {
    const [ax,ay] = ring[j], [bx,by] = ring[i]
    const cross = (x-ax)*(by-ay)-(y-ay)*(bx-ax)
    if (Math.abs(cross)<1e-12 && x>=Math.min(ax,bx)-1e-12 && x<=Math.max(ax,bx)+1e-12 && y>=Math.min(ay,by)-1e-12 && y<=Math.max(ay,by)+1e-12) return 0
    if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside
  }
  return inside ? 1 : -1
}

export function strictlyContains(geometry: Polygon | MultiPolygon, point: Position): boolean {
  const polygons = geometry.type==='Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.some(rings => ringRelation(point,rings[0])===1 && rings.slice(1).every(ring => ringRelation(point,ring)===-1))
}

// O MVT quantiza as coordenadas. Uma pequena margem evita atribuir renda
// a um lado da divisa quando essa precisão não permite decidir com segurança.
export function nearTileBoundary(geometry:Polygon|MultiPolygon,point:Position):boolean {
  const project=([lon,lat]:Position):Position=>{
    const sin=Math.sin(lat*Math.PI/180), scale=4096*2**12
    return [(lon+180)/360*scale,(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale]
  }
  const [px,py]=project(point)
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates
  for (const polygon of polygons) for (const ring of polygon) {
    for(let i=1;i<ring.length;i++) {
      const [ax,ay]=project(ring[i-1]),[bx,by]=project(ring[i])
      const dx=bx-ax,dy=by-ay
      const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy || 1)))
      if ((px-ax-t*dx)**2+(py-ay-t*dy)**2 <= 1.1**2) return true
    }
  }
  return false
}

async function readTile(uf: string, z:number,x:number,y:number): Promise<SectorShape[]> {
  const key = `${uf}/${z}/${x}/${y}`
  if (tiles.has(key)) return tiles.get(key)!
  const request = (async () => {
    const url = new URL(asset(`tiles/setores-${uf}.pmtiles`), document.baseURI).href
    if (!archives.has(url)) archives.set(url,new PMTiles(url))
    const response = await archives.get(url)!.getZxy(z,x,y)
    if (!response) return []
    const layer = new VectorTile(new PbfReader(new Uint8Array(response.data))).layers.setores
    const result: SectorShape[] = []
    for (let i=0;i<(layer?.length??0);i++) {
      const feature = layer.feature(i)
      const geometry = feature.toGeoJSON(x,y,z).geometry
      if (geometry.type!=='Polygon' && geometry.type!=='MultiPolygon') continue
      const properties = feature.properties
      const values = VARIABLE_KEYS.map(key => typeof properties[key]==='number' && Number.isFinite(properties[key]) ? properties[key] : null)
      result.push({geometry,sector:[String(properties.CD_SETOR),...values] as SectorRow})
    }
    return result
  })().catch(error => {tiles.delete(key);throw error})
  tiles.set(key,request)
  while (tiles.size>32) tiles.delete(tiles.keys().next().value!)
  return request
}

export function locateManualSector(row: SchoolRow, manifest: Manifest): Promise<SectorRow|null> {
  const key = `${row[4]},${row[5]}`
  if (locations.has(key)) return locations.get(key)!
  const request = (async () => {
    const [lat,lon] = [row[4],row[5]], z=12, n=2**z
    const x=Math.floor((lon+180)/360*n), sin=Math.sin(lat*Math.PI/180)
    const y=Math.floor((.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*n)
    const states=manifest.states.filter(state => lon>=state.bounds[0] && lat>=state.bounds[1] && lon<=state.bounds[2] && lat<=state.bounds[3])
    const matches = new Map<string,SectorRow>()
    for (const state of states) {
      for (const shape of await readTile(state.uf,z,x,y)) if (strictlyContains(shape.geometry,[lon,lat])) {
        if (nearTileBoundary(shape.geometry,[lon,lat])) return null
        matches.set(shape.sector[0],shape.sector)
      }
    }
    return matches.size===1 ? [...matches.values()][0] : null
  })().catch(error => {locations.delete(key);throw error})
  locations.set(key,request)
  while (locations.size>10000) locations.delete(locations.keys().next().value!)
  return request
}

export async function associateManualSchools(rows:SchoolRow[],manifest:Manifest) {
  const result: Record<string,SectorRow|null> = {}
  let next=0
  await Promise.all(Array.from({length:Math.min(4,rows.length)},async () => {
    while (next<rows.length) {
      const row=rows[next++]
      result[row[0]]=await locateManualSector(row,manifest)
    }
  }))
  return result
}

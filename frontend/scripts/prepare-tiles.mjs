// Pré-processamento local: nada de indexar estados inteiros no navegador.
import { readFileSync, existsSync, statSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { GeoJSONVT } from '@maplibre/geojson-vt'
import { fromGeojsonVt } from '@maplibre/vt-pbf'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const dataDir = resolve(root, 'frontend/public/data')
const manifest = JSON.parse(readFileSync(resolve(dataDir, 'manifest.json')))
const names = [...manifest.states.map(s => `setores-${s.uf}`), 'estados', 'municipios', 'escolas', 'escolas-inep']
const name = process.argv[2]
if (!name) {
  for (const item of names) {
    const result = spawnSync(process.execPath, ['--max-old-space-size=8192', fileURLToPath(import.meta.url), item], { stdio: 'inherit' })
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
  process.exit(0)
}
if (!names.includes(name)) throw new Error('Conjunto desconhecido')
const target = resolve(dataDir, 'tiles', `${name}${name.startsWith('escolas') ? '-v2' : ''}.pmtiles`)
if (existsSync(target) && !process.env.REBUILD_TILES) { console.log(`${name}: já preparado`); process.exit(0) }
const schools = name.startsWith('escolas')
const tracts = name.startsWith('setores-')
const layer = schools ? 'escolas' : tracts ? 'setores' : name
let geojson
if (schools) {
  const rows = JSON.parse(readFileSync(resolve(dataDir, 'escolas.json'))).registros
  geojson = { type: 'FeatureCollection', features: rows.filter(r => name === 'escolas' || r[7] === 'inep').map(r => ({
    type: 'Feature', id: Number(r[0]), properties: { code: r[0], approximate: r[7] !== 'inep', students: r[10] ?? null, missing_students: r[10] == null ? 1 : 0 },
    geometry: { type: 'Point', coordinates: [r[5], r[4]] },
  })) }
} else {
  const source = tracts ? `setores/${name.slice(8)}.geojson.gz` : `${name}.geojson.gz`
  geojson = JSON.parse(gunzipSync(readFileSync(resolve(dataDir, source))))
  // MVT aceita IDs numéricos; os códigos IBGE completos continuam nas propriedades.
  geojson.features.forEach((feature, index) => { feature.id = index })
}
const maxZoom = schools ? 14 : 12
const index = new GeoJSONVT(geojson, {
  maxZoom, indexMaxZoom: 0, indexMaxPoints: 0, tolerance: 3, extent: 4096, buffer: 64,
  cluster: schools, clusterOptions: { maxZoom: 12, radius: 352, extent: 4096,
    map: props => ({ students: props.students ?? 0, missing_students: props.missing_students ?? 0 }),
    reduce: (accumulated, props) => { accumulated.students += props.students ?? 0; accumulated.missing_students += props.missing_students ?? 0 },
  },
})
geojson = null
const writer = spawn('python', [resolve(root, 'scripts/empacotar_tiles.py'), target,
  JSON.stringify({ name, vector_layers: [{ id: layer, fields: {}, minzoom: 0, maxzoom: maxZoom }] })], { stdio: ['pipe', 'inherit', 'inherit'] })
const finished = once(writer, 'exit')
let count = 0
async function visit(z, x, y, descend = true) {
  const tile = index.getTile(z, x, y)
  if (!tile) return
  // null é ausência de publicação, nunca zero. MVT não possui valor null.
  if (tile.features.length) {
  const bytes = gzipSync(fromGeojsonVt({ [layer]: tile }, { extent: 4096 }), { level: 6 })
  const header = Buffer.alloc(16)
  ;[bytes.length, z, x, y].forEach((v, i) => header.writeUInt32LE(v, i * 4))
  if (!writer.stdin.write(Buffer.concat([header, bytes]))) await once(writer.stdin, 'drain')
  count++
  }
  if (descend && z < maxZoom) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) await visit(z + 1, x * 2 + dx, y * 2 + dy)
  }
  // A árvore já foi percorrida; libere os tiles para limitar o pico de memória.
  if (!schools) delete index.tileIndex.tiles[((1 << z) * y + x) * 32 + z]
}
if (schools) {
  // O índice de clusters devolve tiles vazios (não null). Enumerar a árvore
  // mundial visitaria 358 milhões de tiles. Liste só os clusters de cada zoom.
  for (let z = 0; z <= maxZoom; z++) {
    const candidates = new Set()
    const n = 2 ** z
    for (const feature of index.tileIndex.getClusters([-180, -85, 180, 85], z)) {
      const [lon, lat] = feature.geometry.coordinates
      const x = Math.floor((lon + 180) / 360 * n)
      const sin = Math.sin(lat * Math.PI / 180)
      const y = Math.floor((.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n)
      // Inclua tiles vizinhos para preservar pontos no buffer das bordas.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx >= 0 && x + dx < n && y + dy >= 0 && y + dy < n) candidates.add(`${x + dx}/${y + dy}`)
      }
    }
    for (const candidate of candidates) {
      const [x, y] = candidate.split('/').map(Number)
      await visit(z, x, y, false)
    }
  }
} else await visit(0, 0, 0)
writer.stdin.end()
const [code] = await finished
if (code !== 0) throw new Error(`Falha no empacotamento: ${code}`)
console.log(`${name}: ${count} tiles, ${(statSync(target).size / 1e6).toFixed(1)} MB`)

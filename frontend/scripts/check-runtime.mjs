// Smoke test HTTP: evita aprovar um build que não publica o worker do MapLibre.
// Execute com os servidores dev (5173) e preview (4173) ativos.
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { PMTiles } from 'pmtiles'
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'

async function javascript(url) {
  const response = await fetch(url)
  assert.equal(response.status, 200, url)
  assert.match(response.headers.get('content-type') ?? '', /javascript/, `${url}: o servidor devolveu HTML em vez de JavaScript`)
  return response.text()
}

const dev = 'http://127.0.0.1:5173'
const preview = 'http://127.0.0.1:4173'
const wrapper = await javascript(`${dev}/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url`)
const workerPath = JSON.parse(wrapper.match(/export default\s+("[^"]+")/)[1])
await javascript(new URL(workerPath, dev))
console.log('Dev: worker publicado como JavaScript')

const workers = readdirSync(new URL('../dist/assets/', import.meta.url)).filter(name => /^maplibre-gl-worker-.*\.js$/.test(name))
assert.equal(workers.length, 1, 'Build sem o worker empacotado')
const worker = await javascript(`${preview}/assets/${workers[0]}`)
assert(!/from\s*["']\.\/maplibre-gl-shared/.test(worker), 'Worker depende de um arquivo não publicado')
console.log('Produção: worker empacotado e publicado como JavaScript')

for (const base of [dev, preview]) {
  const manifest = await (await fetch(`${base}/data/manifest.json`)).json()
  assert.equal(manifest.missing, '#ffffff')
  assert.deepEqual(manifest.palette, ['#d9f0a3','#addd8e','#78c6a3','#41b6c4','#2c7fb8','#253494'])
  const sectors=await (await fetch(`${base}/data/escolas_setores.json`)).json()
  assert.equal(Object.keys(sectors.schools).length,31053)
  for (const [key,domain] of Object.entries(sectors.domains)) {
    assert(manifest.variables[key] && Number.isFinite(domain.min) && Number.isFinite(domain.max) && domain.min<=domain.max)
  }
  const labels = await (await fetch(`${base}/data/rotulos.geojson`)).json()
  assert.equal(labels.features.filter(f => f.properties.kind === 'estados').length, 27)
  assert.equal(labels.features.filter(f => f.properties.kind === 'municipios').length, 5570)
  assert(labels.features.every(f => f.properties.name && f.geometry.type === 'Point' && f.geometry.coordinates.every(Number.isFinite)))
  const url = `${base}/data/tiles/escolas-v2.pmtiles`
  const response = await fetch(url, { headers: { Range: 'bytes=0-126' } })
  assert.equal(response.status, 206)
  assert.equal((await response.arrayBuffer()).byteLength, 127)
  const archive = new PMTiles(url)
  const tile = await archive.getZxy(0, 0, 0)
  const layer = new VectorTile(new PbfReader(new Uint8Array(tile.data))).layers.escolas
  let count = 0, students = 0, missing = 0
  for (let i = 0; i < layer.length; i++) {
    count += Number(layer.feature(i).properties.point_count ?? 1)
    students += Number(layer.feature(i).properties.students ?? 0)
    missing += Number(layer.feature(i).properties.missing_students ?? 0)
  }
  assert.equal(count, 31053)
  const schools = await (await fetch(`${base}/data/escolas.json`)).json()
  assert.equal(students, schools.matriculas.total_mapeado)
  assert.equal(missing, schools.matriculas.escolas_sem_total)
  console.log(`${base}: HTTP Range, 31.053 escolas, 5.597 rótulos e ausência em branco conferidos`)
}

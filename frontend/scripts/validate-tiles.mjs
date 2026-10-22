// Valida os próprios arquivos que o navegador lê, após a codificação binária.
import assert from 'node:assert/strict'
import { openSync, readSync, closeSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PMTiles, tileIdToZxy } from 'pmtiles'
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const data = resolve(root, 'frontend/public/data')
const manifest = JSON.parse(readFileSync(resolve(data, 'manifest.json')))
const results = []
async function validate(name, layerName, originals, schools = false) {
  const path = resolve(data, 'tiles', `${name}${schools ? '-v2' : ''}.pmtiles`)
  const fd = openSync(path, 'r')
  const source = {
    getKey: () => path,
    async getBytes(offset, length) {
      const bytes = Buffer.alloc(length)
      const size = readSync(fd, bytes, 0, length, offset)
      return { data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + size) }
    },
  }
  const archive = new PMTiles(source)
  const header = await archive.getHeader()
  const seen = new Set()
  let count = 0, largest = 0
  async function directory(offset, length) {
    const entries = await archive.cache.getDirectory(source, offset, length, header)
    for (const entry of entries) {
      if (!entry.runLength) { await directory(header.leafDirectoryOffset + entry.offset, entry.length); continue }
      const [z, x, y] = tileIdToZxy(entry.tileId)
      if (z !== header.maxZoom) continue
      const response = await archive.getZxy(z, x, y)
      assert(response)
      largest = Math.max(largest, entry.length)
      const tile = new VectorTile(new PbfReader(new Uint8Array(response.data))).layers[layerName]
      assert(tile)
      for (let i = 0; i < tile.length; i++) {
        const feature = tile.feature(i)
        const properties = feature.properties
        const code = String(properties[schools ? 'code' : 'CD_SETOR'])
        const original = originals.get(code)
        assert(original, `${name}: código inesperado ${code}`)
        if (!schools) {
          for (const key of ['V06001', 'V06002', 'V06003', 'V06004', 'V06005', 'V06006']) {
            assert.equal(properties[key] ?? null, original[key] ?? null, `${code}: ${key}`)
          }
        } else {
          assert.equal(properties.students ?? null, original[10] ?? null, `Matrículas divergentes: ${code}`)
          assert.equal(properties.missing_students, original[10] == null ? 1 : 0)
          assert.equal(properties.approximate, original[7] !== 'inep')
          const point = feature.toGeoJSON(x, y, z).geometry.coordinates
          assert(Math.abs(point[0] - original[5]) < .00001 && Math.abs(point[1] - original[4]) < .00001, `Coordenada divergente: ${code}`)
        }
        seen.add(code)
      }
      count++
    }
  }
  try {
    await directory(header.rootDirectoryOffset, header.rootDirectoryLength)
    assert.equal(seen.size, originals.size, `${name}: registros ausentes nos tiles`)
    if (schools) {
      const overview = await archive.getZxy(0, 0, 0)
      const layer = new VectorTile(new PbfReader(new Uint8Array(overview.data))).layers.escolas
      let total = 0, students = 0, missing = 0
      for (let i = 0; i < layer.length; i++) {
        const properties = layer.feature(i).properties
        total += Number(properties.point_count ?? 1)
        students += Number(properties.students ?? 0)
        missing += Number(properties.missing_students ?? 0)
      }
      assert.equal(total, originals.size)
      assert.equal(students, [...originals.values()].reduce((sum, row) => sum + (row[10] ?? 0), 0))
      assert.equal(missing, [...originals.values()].filter(row => row[10] == null).length)
    }
    results.push({ name, registros: seen.size, tilesDetalhados: count, maiorTileCompactado: largest })
    console.log(`${name}: ${seen.size} registros conferidos; maior tile ${(largest / 1024).toFixed(1)} KiB`)
  } finally { closeSync(fd) }
}
for (const state of manifest.states) {
  const geojson = JSON.parse(gunzipSync(readFileSync(resolve(data, `setores/${state.uf}.geojson.gz`))))
  await validate(`setores-${state.uf}`, 'setores', new Map(geojson.features.map(f => [f.properties.CD_SETOR, f.properties])))
}
const schools = JSON.parse(readFileSync(resolve(data, 'escolas.json'))).registros
await validate('escolas', 'escolas', new Map(schools.map(r => [r[0], r])), true)
await validate('escolas-inep', 'escolas', new Map(schools.filter(r => r[7] === 'inep').map(r => [r[0], r])), true)
writeFileSync(resolve(data, 'tiles/validacao.json'), JSON.stringify({ registrosSetores: results.filter(r => r.name.startsWith('setores-')).reduce((n, r) => n + r.registros, 0), arquivos: results }, null, 2))

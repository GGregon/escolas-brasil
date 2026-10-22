// Integração com os dados nacionais, o servidor local e o índice de clusters real.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { GeoJSONVT } from '@maplibre/geojson-vt'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const read=name=>JSON.parse(readFileSync(resolve(root,'public/data',name)))
const schools=read('escolas.json').registros, sectors=read('escolas_setores.json'), manifest=read('manifest.json')
const server=await createServer({root,server:{middlewareMode:true,hmr:false},appType:'custom'})
globalThis.document={baseURI:'http://127.0.0.1:5173/'}
try {
  const {eligibleSchools,schoolFeatures}=await server.ssrLoadModule('/src/sectorFilter.ts')
  const {locateManualSector}=await server.ssrLoadModule('/src/manualSectors.ts')
  const settings={variable:'V06004',layers:{tracts:true,schools:true,states:true,municipalities:false,approximate:true},range:{min:3000,max:8000}}
  const filtered=eligibleSchools(schools,sectors.schools,settings)
  assert(filtered.length>0 && filtered.length<schools.length)
  for (const row of filtered) assert(sectors.schools[row[0]][4]>=3000 && sectors.schools[row[0]][4]<=8000)
  const index=new GeoJSONVT(schoolFeatures(filtered),{cluster:true,clusterOptions:{extent:4096,maxZoom:12,radius:352,
    map:props=>({students:props.students??0,missing_students:props.missing_students}),
    reduce:(acc,props)=>{acc.students+=props.students;acc.missing_students+=props.missing_students},
  }})
  const overview=index.getTile(0,0,0)
  assert.equal(overview.features.reduce((sum,f)=>sum+(f.tags.point_count??1),0),filtered.length)
  const sum=filtered.reduce((sum,row)=>sum+(row[10]??0),0)
  assert.equal(overview.features.reduce((sum,f)=>sum+(f.tags.students??0),0),sum)
  console.log(`Faixa R$ 3.000–8.000: ${filtered.length} escolas, ${sum} matrículas; agrupamentos conferidos.`)
  let matched=0, uncertain=0
  for(let i=0;i<schools.length;i+=Math.ceil(schools.length/30)) {
    const row=schools[i],expected=sectors.schools[row[0]]
    if(!expected)continue
    const located=await locateManualSector(row,manifest)
    if(!located){uncertain++;continue}
    assert.deepEqual(located,expected,`Associação espacial divergente: ${row[0]}`)
    matched++
  }
  assert(matched>=15)
  console.log(`Associação por HTTP: ${matched} coordenadas conferidas; ${uncertain} junto a limites ficaram sem associação.`)
} finally {
  await server.close()
  delete globalThis.document
}

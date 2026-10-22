import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validateStyleMin, type StyleSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { Manifest, Settings } from './types'
import { brightStyle } from './basemap'
import { makeManualSchool } from './manualSchools'

const workerConfiguration = vi.hoisted(() => ({ url: '' }))

class FakeMap {
  constructor(private style: StyleSpecification) {
    this.layers = structuredClone(style.layers) as FakeMap['layers']
    for (const [id, source] of Object.entries(style.sources)) this.addSource(id, source)
  }
  getStyle() { return { ...this.style, layers: this.layers } }
  addControl() {}
  listeners = new Map<string, (payload?: unknown) => void>()
  sources = new Map<string, { spec: unknown; updateImage: ReturnType<typeof vi.fn>; setData: ReturnType<typeof vi.fn> }>()
  layers: { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown>; filter?: unknown }[] = []
  zoom = 3
  touchZoomRotate = { disableRotation() {} }
  on(event: string, listener: (payload?: unknown) => void) { this.listeners.set(event, listener) }
  fire(event: string, payload?: unknown) { this.listeners.get(event)?.(payload) }
  queryRenderedFeatures = vi.fn((): unknown[] => [])
  easeTo = vi.fn()
  jumpTo = vi.fn()
  addSource(id: string, spec: unknown) { this.sources.set(id, { spec, updateImage: vi.fn(), setData: vi.fn() }) }
  getSource(id: string) { return this.sources.get(id) }
  addLayer(layer: FakeMap['layers'][number], before?: string) {
    const index = before ? this.layers.findIndex(item => item.id === before) : -1
    if (index < 0) this.layers.push(layer); else this.layers.splice(index, 0, layer)
  }
  getLayer(id: string) { return this.layers.find(layer => layer.id === id) }
  setLayoutProperty(id: string, key: string, value: unknown) { const l = this.getLayer(id)!; l.layout = { ...l.layout, [key]: value } }
  setPaintProperty(id: string, key: string, value: unknown) { const l = this.getLayer(id)!; l.paint = { ...l.paint, [key]: value } }
  setFilter(id: string, filter: unknown) { this.getLayer(id)!.filter = filter }
  removeLayer(id: string) { this.layers = this.layers.filter(layer => layer.id !== id) }
  removeSource(id: string) { this.sources.delete(id) }
  fitBounds = vi.fn()
  getZoom() { return this.zoom }
  getBounds() { return { getWest: () => -48, getSouth: () => -16, getEast: () => -47, getNorth: () => -15 } }
  remove() {}
}

vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn((url: string) => { workerConfiguration.url = url }),
  addProtocol: vi.fn(),
  AttributionControl: class {},
  Map: class { constructor(options: { style: StyleSpecification }) {
    if (!workerConfiguration.url) throw new Error('Worker não configurado antes de criar o mapa')
    return new FakeMap(options.style)
  } },
  Popup: class { remove() { return this } },
}))
vi.mock('./data', () => ({ asset: (name: string) => `/data/${name}` }))

import { MapController } from './MapController'

const variables = Object.fromEntries(['V06001','V06002','V06003','V06004','V06005','V06006'].map(key => [key, { label: key, description: key, unit: 'R$', breaks: [1212,2424,4848,9696,19392], available: 1 }])) as Manifest['variables']
const manifest: Manifest = { schemaVersion: 1, year: 2022, variables, palette: ['#e4f2eb','#b8dece','#83c5b5','#4caaa2','#238687','#115665'], missing: '#ffffff', imageCoordinates: [[-74,6],[-28,6],[-28,-34],[-74,-34]], bounds: [[-74,-34],[-28,6]], states: [{ uf:'53', bounds:[-48,-16,-47,-15], count:1 }], total:1, schools:{privadas_ativas:0,mapeadas:0,fora_do_mapa:0}, boundaries:{estados:27,municipios:5570} }
const settings: Settings = { variable:'V06004', layers:{tracts:true,states:true,municipalities:false,schools:true,approximate:true} }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', { innerWidth:1440 })
  vi.stubGlobal('document', { baseURI: 'http://localhost:5173/' })
})

async function initialize() {
  const status = vi.fn()
  const selection = vi.fn()
  const controller = new MapController({} as HTMLDivElement, manifest, { ano:2025,meta:manifest.schools,registros:[['53000001','Escola teste','Brasília','DF',-15.8,-47.9,'Particular','inep',null,null]] }, settings, selection, status)
  const map = controller.map as unknown as FakeMap
  map.fire('load')
  await vi.waitFor(() => expect(map.getLayer('estados-line')).toBeDefined())
  return { controller, map, status, selection }
}

describe('Integração de indicadores e camadas', () => {
  it('recalcula escolas agrupadas pelo intervalo e restaura tiles ao limpar o filtro',async()=>{
    const {controller,map,selection}=await initialize()
    const manual=makeManualSchool('Escola local','-15.7','-47.8')
    controller.setManualSchools([manual])
    controller.setSectorLookup({'53000001':['530010805000001',10,20,1,5000,100,3000],[manual[0]]:['530010805000002',10,20,1,9000,100,4000]})
    controller.update({...settings,range:{min:3000,max:8000}})
    expect(map.getLayer('school-points')).toMatchObject({source:'filtered-schools'})
    expect(map.getLayer('school-points')).not.toHaveProperty('source-layer')
    expect(map.getLayer('manual-school-points')!.layout!.visibility).toBe('none')
    await vi.waitFor(()=>expect(map.getSource('filtered-schools')!.setData).toHaveBeenLastCalledWith(expect.objectContaining({features:[expect.objectContaining({properties:expect.objectContaining({code:'53000001'})})]})))
    const style={...brightStyle(),sources:Object.fromEntries([...map.sources].map(([id,source])=>[id,source.spec])),layers:map.layers} as StyleSpecification
    expect(validateStyleMin(style).map(error=>error.message)).toEqual([])
    controller.select({kind:'school',data:manual})
    expect(selection).toHaveBeenLastCalledWith(null)
    controller.update({...settings,range:{min:6000,max:8000}})
    await vi.waitFor(()=>expect(map.getSource('filtered-schools')!.setData).toHaveBeenLastCalledWith({type:'FeatureCollection',features:[]}))
    controller.update({...settings,range:null})
    expect(map.getLayer('school-points')).toMatchObject({source:'schools','source-layer':'escolas'})
    expect(map.getLayer('manual-school-points')!.layout!.visibility).toBe('visible')
    controller.destroy()
  })
  it('exibe e consulta cadastros manuais mesmo com geocodificadas desligadas', async () => {
    const {controller,map,selection} = await initialize()
    controller.update({...settings,layers:{...settings.layers,approximate:false}})
    const row = makeManualSchool('Escola manual','-15.8','-47.9')
    controller.setManualSchools([row])
    expect(map.getSource('manual-schools')!.setData).toHaveBeenLastCalledWith(expect.objectContaining({features:[expect.objectContaining({properties:{code:row[0]}})]}))
    map.queryRenderedFeatures.mockReturnValue([{layer:{id:'manual-school-points'},geometry:{type:'Point',coordinates:[-47.9,-15.8]},properties:{code:row[0]}}])
    map.fire('click',{point:{x:100,y:100}})
    expect(selection).toHaveBeenLastCalledWith(expect.objectContaining({kind:'school',data:row}))
    controller.setManualSchools([])
    expect(selection).toHaveBeenLastCalledWith(null)
    controller.destroy()
  })
  it('enquadra a cidade pesquisada e abre a escola pesquisada fora dos agrupamentos', async () => {
    const { controller, map, selection } = await initialize()
    controller.focusSearch({kind:'city',id:'5300108',name:'Brasília',uf:'DF',coordinates:[-47.9,-15.8],bounds:[-48.3,-16.1,-47.3,-15.4]})
    expect(map.fitBounds).toHaveBeenLastCalledWith([[-48.3,-16.1],[-47.3,-15.4]], expect.objectContaining({maxZoom:13,animate:false}))
    expect(selection).toHaveBeenLastCalledWith(expect.objectContaining({kind:'boundary',code:'5300108'}))
    controller.focusSearch({kind:'school',id:'53000001',name:'Escola teste',city:'Brasília',uf:'DF',row:['53000001','Escola teste','Brasília','DF',-15.8,-47.9,'Particular','inep',null,null]})
    expect(map.jumpTo).toHaveBeenLastCalledWith(expect.objectContaining({center:[-47.9,-15.8],zoom:16,padding:expect.objectContaining({right:390})}))
    expect(map.jumpTo.mock.invocationCallOrder.at(-1)).toBeLessThan(selection.mock.invocationCallOrder.at(-1)!)
    expect(selection).toHaveBeenLastCalledWith(expect.objectContaining({kind:'school'}))
    expect(map.getLayer('school-selected')!.filter).toEqual(['==',['get','code'],'53000001'])
    controller.destroy()
  })
  it('configura o worker empacotado pelo Vite antes de iniciar as camadas', async () => {
    const { controller } = await initialize()
    expect(workerConfiguration.url).toContain('maplibre-gl-worker')
    controller.destroy()
  })
  it('troca a visão geral e os polígonos, ativa municípios e mantém as camadas independentes', async () => {
    const { controller,map } = await initialize()
    map.zoom=8; map.fire('moveend')
    await vi.waitFor(() => expect(map.getLayer('tract-fill-53')).toBeDefined())
    controller.update({ variable:'V06001',layers:{...settings.layers,states:false,municipalities:true} })
    await vi.waitFor(() => expect(map.getLayer('municipios-line')).toBeDefined())
    expect(map.getSource('overview')).toBeUndefined()
    expect(map.getSource('tract-53')!.spec).toMatchObject({ type: 'vector', url: 'pmtiles://http://localhost:5173/data/tiles/setores-53.pmtiles' })
    expect(JSON.stringify(map.getLayer('tract-fill-53')!.paint)).toContain('V06001')
    expect(map.getLayer('estados-line')!.layout!.visibility).toBe('none')
    expect(map.getLayer('municipios-line')!.layout!.visibility).toBe('visible')
    const style={...brightStyle(),sources:Object.fromEntries([...map.sources].map(([id,source])=>[id,source.spec])),layers:map.layers} as StyleSpecification
    expect(validateStyleMin(style).map(error=>error.message)).toEqual([])
    controller.destroy()
  })

  it('mantem fontes permanentes e escolas acima dos setores ao alternar as camadas', async () => {
    const { controller, map } = await initialize()
    const source = map.getSource('tract-53')
    controller.update({...settings, layers:{...settings.layers, tracts:false, approximate:false}})
    expect(map.getSource('tract-53')).toBe(source)
    expect(map.getLayer('tract-fill-53')!.layout!.visibility).toBe('none')
    expect(map.getLayer('school-points')).toMatchObject({source:'schools-inep'})
    expect(map.layers.at(-1)!.id).toBe('school-selected')
    controller.update(settings)
    expect(map.getSource('tract-53')).toBe(source)
    expect(map.getLayer('school-points')).toMatchObject({source:'schools'})
    expect(map.getLayer('tract-fill-53')!.layout!.visibility).toBe('visible')
    controller.destroy()
  })

  it('consulta uma escola e aproxima os agrupamentos usando tiles prontos', async () => {
    const { controller, map, selection } = await initialize()
    map.queryRenderedFeatures.mockReturnValue([{ layer:{id:'school-points'}, geometry:{type:'Point',coordinates:[-47.9,-15.8]}, properties:{code:'53000001'} }])
    map.fire('click', {point:{x:100,y:100}})
    expect(selection).toHaveBeenLastCalledWith(expect.objectContaining({kind:'school',data:expect.arrayContaining(['53000001','Escola teste'])}))
    expect(map.getLayer('school-selected')!.filter).toEqual(['==',['get','code'],'53000001'])
    controller.clearSelection()
    expect(map.getLayer('school-selected')!.filter).toEqual(['==',['get','code'],''])
    map.queryRenderedFeatures.mockReturnValue([{ layer:{id:'school-clusters'}, geometry:{type:'Point',coordinates:[-47.9,-15.8]}, properties:{cluster_id:1,point_count:10} }])
    map.fire('click', {point:{x:100,y:100}})
    expect(map.easeTo).toHaveBeenCalledWith({center:[-47.9,-15.8],zoom:5,duration:450})
    controller.destroy()
  })

  it('mantém ruas e rótulos acima da renda e alterna siglas/municípios pelo zoom', async () => {
    const { controller, map } = await initialize()
    const ids = map.layers.map(layer => layer.id)
    expect(ids.indexOf('tract-fill-53')).toBeLessThan(ids.indexOf('building'))
    expect(ids.indexOf('tract-fill-53')).toBeLessThan(ids.indexOf('highway-name-major'))
    expect(map.getLayer('label_state')).toBeUndefined()
    expect(map.getLayer('state-labels')).toMatchObject({maxzoom:6.5})
    expect(map.getLayer('municipality-labels')).toMatchObject({minzoom:6.5})
    expect(JSON.stringify(map.getLayer('municipality-labels'))).not.toContain('"visibility":"none"')
    controller.destroy()
  })
})

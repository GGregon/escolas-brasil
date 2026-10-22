import * as maplibregl from 'maplibre-gl'
import type { MapMouseEvent, GeoJSONSource } from 'maplibre-gl'
import { schoolRadius, clusterRadius } from './schoolStyle'
import { Protocol } from 'pmtiles'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { asset } from './data'
import { fillExpression, formatValue, numbers } from './indicators'
import { brightStyle } from './basemap'
import { eligibleSchools, inRange, schoolFeatures, sectorValue } from './sectorFilter'
import type { SearchResult } from './search'
import type { Manifest, MapStatus, SchoolsData, SchoolRow, SchoolSectors, Selection, Settings, TractProperties } from './types'

const protocol = new Protocol()
// MapLibre 6 usa um worker ESM separado. O pipeline do Vite precisa incluir
// também suas dependências; ?url sozinho falha no build de produção.
maplibregl.setWorkerUrl(workerUrl)
maplibregl.addProtocol('pmtiles', protocol.tile)

export class MapController {
  readonly map: maplibregl.Map
  private settings: Settings
  private disposed = false
  private ready = false
  private failed = false
  private tractStates = new Set<string>()
  private hoverFrame = 0
  private selectedCode = ''
  private selectedSchool = ''
  private pendingSearch: SearchResult | null = null
  private schoolById: Map<string, SchoolRow>
  private manualRows: SchoolRow[] = []
  private sectorLookup: SchoolSectors['schools'] = {}
  private filterTimer: ReturnType<typeof setTimeout> | null = null
  private tooltip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'map-tooltip' })

  constructor(
    element: HTMLDivElement,
    private manifest: Manifest,
    private schools: SchoolsData,
    settings: Settings,
    private onSelection: (selection: Selection | null) => void,
    private onStatus: (status: MapStatus) => void,
  ) {
    this.settings = settings
    this.schoolById = new Map(schools.registros.map(row => [row[0], row]))
    this.map = new maplibregl.Map({
      container: element,
      style: brightStyle(),
      center: [-51, -15], zoom: 3.5, minZoom: 2, maxZoom: 18,
      attributionControl: false, dragRotate: false, pitchWithRotate: false,
    })
    this.map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: [
      '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a>',
      '<a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a>',
      '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>',
      `<a href="${import.meta.env.BASE_URL}creditos.txt" target="_blank" rel="noopener">Créditos</a>`,
    ] }), 'bottom-left')
    this.map.touchZoomRotate.disableRotation()
    this.map.on('load', () => this.initialize())
    this.map.on('dataloading', () => {
      if (this.ready && !this.failed) this.onStatus({ loading: true, message: 'Carregando área visível' })
    })
    this.map.on('idle', () => {
      if (!this.disposed && !this.failed) this.onStatus({ loading: false, message: '' })
    })
    this.map.on('click', event => { void this.handleClick(event) })
    this.map.on('mousemove', event => {
      if (this.hoverFrame || this.map.isMoving()) return
      this.hoverFrame = requestAnimationFrame(() => { this.hoverFrame = 0; this.handleHover(event) })
    })
    this.map.on('mouseout', () => this.tooltip.remove())
    this.map.on('error', event => {
      console.error('MapLibre:', event.error)
      this.failed = true
      if (this.ready && !this.disposed) this.onStatus({ loading: false, message: 'Não foi possível desenhar uma camada. Recarregue o mapa.', error: true })
    })
  }

  private tileSource(id: string, archive: string, bounds?: [number, number, number, number]) {
    this.map.addSource(id, {
      type: 'vector', url: `pmtiles://${new URL(asset(`tiles/${archive}.pmtiles`), document.baseURI).href}`,
      ...(bounds ? { bounds } : {}),
    })
  }

  private initialize() {
    const map = this.map
    // As ruas, construções e os textos Bright ficam acima do preenchimento.
    const before = map.getStyle().layers.find(layer => 'source-layer' in layer && ['building', 'transportation'].includes(layer['source-layer']!))?.id
    const beforeLabels = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id
    // Fontes permanentes: o próprio MapLibre busca e mantém apenas os tiles visíveis.
    for (const state of this.manifest.states) {
      const uf = state.uf
      this.tileSource(`tract-${uf}`, `setores-${uf}`, state.bounds)
      map.addLayer({ id: `tract-fill-${uf}`, type: 'fill', source: `tract-${uf}`, 'source-layer': 'setores',
        paint: { 'fill-color': fillExpression(this.settings.variable, this.manifest.variables[this.settings.variable], this.manifest.palette, this.manifest.missing), 'fill-opacity': this.tractOpacity() } }, before)
      map.addLayer({ id: `tract-line-${uf}`, type: 'line', source: `tract-${uf}`, 'source-layer': 'setores', minzoom: 11,
        paint: { 'line-color': '#517572', 'line-width': .4, 'line-opacity': .4 } }, before)
      map.addLayer({ id: `tract-selected-${uf}`, type: 'line', source: `tract-${uf}`, 'source-layer': 'setores',
        filter: ['==', ['get', 'CD_SETOR'], ''], paint: { 'line-color': '#102f35', 'line-width': 2.5 } }, before)
      this.tractStates.add(uf)
    }
    for (const kind of ['estados', 'municipios'] as const) {
      this.tileSource(kind, kind)
      map.addLayer({ id: `${kind}-hit`, type: 'fill', source: kind, 'source-layer': kind,
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0 } }, beforeLabels)
      map.addLayer({ id: `${kind}-line`, type: 'line', source: kind, 'source-layer': kind,
        paint: kind === 'estados'
          ? { 'line-color': '#365568', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, .65, 9, 1.3], 'line-opacity': .72 }
          : { 'line-color': '#536f7d', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, .3, 10, 1], 'line-opacity': .52 } }, beforeLabels)
    }
    this.addLabels()
    this.tileSource('schools', 'escolas-v2')
    this.tileSource('schools-inep', 'escolas-inep-v2')
    this.map.addSource('filtered-schools', {type:'geojson',data:schoolFeatures([]),cluster:true,clusterRadius:44,clusterMaxZoom:12,
      clusterProperties:{students:['+',['coalesce',['get','students'],0]],missing_students:['+',['get','missing_students']]}})
    this.addSchools()
    this.map.addSource('manual-schools', {type:'geojson',data:{type:'FeatureCollection',features:[]}})
    this.map.addLayer({id:'manual-school-points',type:'circle',source:'manual-schools',paint:{'circle-color':'#db6d45','circle-radius':4,'circle-stroke-color':'#536c83','circle-stroke-width':2}})
    this.map.addLayer({id:'manual-school-selected',type:'circle',source:'manual-schools',filter:['==',['get','code'],''],paint:{'circle-radius':9,'circle-color':'#b34c28','circle-stroke-color':'#ffffff','circle-stroke-width':3}})
    this.ready = true
    this.setManualSchools(this.manualRows)
    this.applySettings(true)
    this.refreshFilteredSchools()
    const mobile = window.innerWidth < 760
    map.fitBounds(this.manifest.bounds, {
      padding: mobile ? { top: 24, bottom: 255, left: 16, right: 16 } : { top: 38, bottom: 38, left: 40, right: 390 }, duration: 0,
    })
    if (this.pendingSearch) {
      const result = this.pendingSearch
      this.pendingSearch = null
      this.focusSearch(result)
    }
  }

  focusSearch(result: SearchResult) {
    if (this.disposed) return
    if (!this.ready) { this.pendingSearch = result; return }
    const mobile = window.innerWidth < 760
    const padding = mobile ? { top: 32, bottom: 112, left: 24, right: 24 } : { top: 50, bottom: 50, left: 50, right: 390 }
    if (result.kind === 'school') {
      const row = result.row
      const others = this.schoolNeighbours(row)
      // A pesquisa é uma navegação direta: não depende de uma animação que
      // possa ser interrompida por outra interação ou por atualizações da UI.
      this.map.jumpTo({ center: [row[5], row[4]], zoom: 16, padding })
      if (this.settings.range && !inRange(sectorValue(this.sectorLookup[row[0]],this.settings.variable),this.settings.range)) {
        this.clearSelection()
        this.onStatus({loading:false,message:'Escola fora do intervalo ou sem setor com valor publicado.'})
        return
      }
      this.select({ kind: 'school', data: row, others: others.length > 1 ? others : undefined })
    } else {
      if (result.bounds) {
        const [west, south, east, north] = result.bounds
        this.map.fitBounds([[west, south], [east, north]], {
          padding, maxZoom: 13, animate: false,
        })
      } else this.map.jumpTo({ center: result.coordinates, zoom: 11, padding })
      this.select({ kind: 'boundary', name: `${result.name} · ${result.uf}`, code: result.id, level: 'Município' })
    }
  }

  setManualSchools(rows: SchoolRow[]) {
    for (const old of this.manualRows) this.schoolById.delete(old[0])
    this.manualRows = rows
    for (const row of rows) this.schoolById.set(row[0], row)
    if (!this.ready || this.disposed) return
    ;(this.map.getSource('manual-schools') as GeoJSONSource).setData({type:'FeatureCollection',features:rows.map(row => ({
      type:'Feature',properties:{code:row[0]},geometry:{type:'Point',coordinates:[row[5],row[4]]},
    }))})
    if (this.selectedSchool.startsWith('local-') && !rows.some(row => row[0] === this.selectedSchool)) this.clearSelection()
    this.refreshFilteredSchools()
  }

  setSectorLookup(lookup:SchoolSectors['schools']) {
    this.sectorLookup=lookup
    this.refreshFilteredSchools()
  }

  private refreshFilteredSchools() {
    if (this.filterTimer) {clearTimeout(this.filterTimer);this.filterTimer=null}
    if (!this.ready || this.disposed) return
    if (!this.settings.range) {
      ;(this.map.getSource('filtered-schools') as GeoJSONSource).setData(schoolFeatures([]))
      return
    }
    this.onStatus({loading:true,message:'Atualizando escolas do intervalo'})
    this.filterTimer=setTimeout(() => {
      this.filterTimer=null
      if (this.disposed || !this.settings.range) return
      const rows=eligibleSchools([...this.schools.registros,...this.manualRows],this.sectorLookup,this.settings)
      ;(this.map.getSource('filtered-schools') as GeoJSONSource).setData(schoolFeatures(rows))
      if (this.selectedSchool && !rows.some(row=>row[0]===this.selectedSchool)) this.clearSelection()
    },160)
  }

  private schoolNeighbours(row: SchoolRow) {
    return eligibleSchools([...this.schools.registros,...this.manualRows],this.sectorLookup,this.settings).filter(r => r[4] === row[4] && r[5] === row[5])
  }

  update(settings: Settings) {
    const previous = this.settings
    this.settings = settings
    if (!this.ready || this.disposed) return
    if (this.selectedSchool && (!settings.layers.schools || (!settings.layers.approximate && this.schoolById.get(this.selectedSchool)?.[7] === 'geocodebr'))) this.clearSelection()
    const rangeChanged=previous.range?.min!==settings.range?.min || previous.range?.max!==settings.range?.max
    if (!!previous.range!==!!settings.range || previous.layers.approximate !== settings.layers.approximate) {
      this.map.removeLayer('school-points')
      this.map.removeLayer('school-clusters')
      this.map.removeLayer('school-selected')
      this.addSchools()
    }
    this.applySettings(previous.variable !== settings.variable || rangeChanged)
    if (rangeChanged || previous.variable!==settings.variable || previous.layers.approximate!==settings.layers.approximate) this.refreshFilteredSchools()
  }

  clearSelection() {
    this.selectedCode = ''
    this.selectedSchool = ''
    this.onSelection(null)
    this.applySettings()
  }

  select(selection: Selection) {
    if (selection.kind==='school' && this.settings.range && !inRange(sectorValue(this.sectorLookup[selection.data[0]],this.settings.variable),this.settings.range)) {
      this.clearSelection()
      return
    }
    this.selectedCode = selection.kind === 'tract' ? selection.data.CD_SETOR : ''
    this.selectedSchool = selection.kind === 'school' ? selection.data[0] : ''
    this.tooltip.remove()
    this.onSelection(selection)
    this.applySettings()
  }

  private setVisible(id: string, visible: boolean) {
    if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }

  private applySettings(repaint = false) {
    const { layers, variable } = this.settings
    for (const uf of this.tractStates) {
      this.setVisible(`tract-fill-${uf}`, layers.tracts)
      this.setVisible(`tract-line-${uf}`, layers.tracts)
      this.setVisible(`tract-selected-${uf}`, layers.tracts)
      if (repaint) {
        this.map.setPaintProperty(`tract-fill-${uf}`, 'fill-color', fillExpression(variable, this.manifest.variables[variable], this.manifest.palette, this.manifest.missing))
        this.map.setPaintProperty(`tract-fill-${uf}`, 'fill-opacity', this.tractOpacity())
      }
      this.map.setFilter(`tract-selected-${uf}`, ['==', ['get', 'CD_SETOR'], this.selectedCode])
    }
    for (const [kind, visible] of [['estados', layers.states], ['municipios', layers.municipalities]] as const) {
      this.setVisible(`${kind}-line`, visible)
      this.setVisible(`${kind}-hit`, visible)
    }
    this.setVisible('school-clusters', layers.schools)
    this.setVisible('school-points', layers.schools)
    this.setVisible('school-selected', layers.schools)
    this.setVisible('manual-school-points', layers.schools && !this.settings.range)
    this.setVisible('manual-school-selected', layers.schools && !this.settings.range)
    this.map.setFilter('school-selected', ['==', ['get', 'code'], this.selectedSchool])
    this.map.setFilter('manual-school-selected', ['==', ['get', 'code'], this.selectedSchool])
  }

  private tractOpacity(): maplibregl.ExpressionSpecification {
    const missing: maplibregl.ExpressionSpecification = ['==', ['get', this.settings.variable], null]
    const range=this.settings.range
    const opacity=(normal:number):maplibregl.ExpressionSpecification => range
      ? ['case',missing,1,['all',['>=',['get',this.settings.variable],range.min],['<=',['get',this.settings.variable],range.max]],normal,.10]
      : ['case',missing,1,normal]
    return ['interpolate', ['linear'], ['zoom'], 4, opacity(.84), 11, opacity(.66), 15, opacity(.44)]
  }

  private addLabels() {
    this.map.addSource('administrative-labels', { type: 'geojson', data: new URL(asset('rotulos.geojson'), document.baseURI).href })
    this.map.addLayer({ id: 'state-labels', type: 'symbol', source: 'administrative-labels', maxzoom: 6.5,
      filter: ['==', ['get', 'kind'], 'estados'],
      layout: { 'text-field': ['get', 'uf'], 'text-font': ['Noto Sans Bold'], 'text-size': 14, 'text-letter-spacing': .12, 'text-padding': 9 },
      paint: { 'text-color': '#36515b', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } })
    this.map.addLayer({ id: 'municipality-labels', type: 'symbol', source: 'administrative-labels', minzoom: 6.5,
      filter: ['==', ['get', 'kind'], 'municipios'],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 6.5, 10, 10, 12, 14, 14],
        'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'], 'text-radial-offset': .5, 'text-padding': 7, 'symbol-sort-key': ['-', ['get', 'area']] },
      paint: { 'text-color': '#29444f', 'text-halo-color': '#ffffff', 'text-halo-width': 1.8 } })
  }

  private addSchools() {
    const source = this.settings.range ? 'filtered-schools' : this.settings.layers.approximate ? 'schools' : 'schools-inep'
    const sourceLayer=this.settings.range ? {} : {'source-layer':'escolas'}
    this.map.addLayer({
      id: 'school-clusters', type: 'circle', source, ...sourceLayer, filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#df744e', 'circle-opacity': .83, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.4,
        'circle-radius': clusterRadius,
      },
    })
    this.map.addLayer({
      id: 'school-points', type: 'circle', source, ...sourceLayer, filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#db6d45', 'circle-radius': schoolRadius,
        'circle-opacity': ['case', ['boolean', ['get', 'approximate'], false], .65, .95],
        'circle-stroke-color': '#943f26', 'circle-stroke-width': 1.2,
      },
    })
    this.map.addLayer({ id: 'school-selected', type: 'circle', source, ...sourceLayer, filter: ['==', ['get', 'code'], this.selectedSchool],
      paint: { 'circle-radius': schoolRadius, 'circle-color': '#b34c28', 'circle-opacity': 1, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } })
  }

  private handleClick(event: MapMouseEvent) {
    if (!this.ready) return
    const features = this.map.queryRenderedFeatures(event.point, { layers: this.interactiveLayers() })
    const school = features.find(f => ['school-clusters','school-points','manual-school-points'].includes(f.layer.id))
    if (school && school.geometry.type === 'Point') {
      const point = school.geometry.coordinates as [number, number]
      if (school.properties.cluster_id !== undefined) {
        const zoom = this.map.getZoom() + 2
        this.map.easeTo({ center: point, zoom: Math.min(zoom, 17), duration: 450 })
      } else {
        const row = this.schoolById.get(String(school.properties.code))
        if (row) {
          const others = this.schoolNeighbours(row)
          this.select({ kind: 'school', data: row, others: others.length > 1 ? others : undefined })
          this.map.easeTo({ center: [row[5], row[4]], duration: 250 })
        }
      }
      return
    }
    const tract = features.find(f => f.layer.id.startsWith('tract-fill-'))
    if (tract) { this.select({ kind: 'tract', data: tract.properties as TractProperties }); return }
    const boundary = features.find(f => f.layer.id === 'municipios-hit') ?? features.find(f => f.layer.id === 'estados-hit')
    if (boundary) this.select({ kind: 'boundary', name: boundary.properties.name, code: String(boundary.properties.code), level: boundary.layer.id.startsWith('municipios') ? 'Município' : 'Estado' })
    else this.clearSelection()
  }

  private interactiveLayers() {
    return ['manual-school-points','school-points', 'school-clusters', ...[...this.tractStates].map(uf => `tract-fill-${uf}`), 'municipios-hit', 'estados-hit']
      .filter(id => this.map.getLayer(id))
  }

  private handleHover(event: MapMouseEvent) {
    if (!this.ready) return
    const features = this.map.queryRenderedFeatures(event.point, { layers: this.interactiveLayers() })
    const school = features.find(f => ['school-clusters','school-points','manual-school-points'].includes(f.layer.id))
    const tract = features.find(f => f.layer.id.startsWith('tract-fill-'))
    const boundary = features.find(f => f.layer.id === 'municipios-hit' || f.layer.id === 'estados-hit')
    let text = ''
    if (school) text = school.properties.point_count ? `${numbers.format(Number(school.properties.point_count))} escolas · ${numbers.format(Number(school.properties.students ?? 0))} matrículas informadas${school.properties.missing_students ? ` · ${school.properties.missing_students} sem total` : ''} · Clique para aproximar` : this.schoolById.get(String(school.properties.code))?.[1] ?? ''
    else if (tract) text = `${tract.properties.NM_MUN} · ${formatValue(tract.properties[this.settings.variable], this.manifest.variables[this.settings.variable])}`
    else if (boundary) text = boundary.properties.name
    this.map.getCanvas().style.cursor = text ? 'pointer' : ''
    if (school && this.selectedSchool && String(school.properties.code) === this.selectedSchool) this.tooltip.remove()
    else if (text) this.tooltip.setLngLat(event.lngLat).setText(text).addTo(this.map)
    else this.tooltip.remove()
  }

  destroy() {
    this.disposed = true
    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame)
    if (this.filterTimer) clearTimeout(this.filterTimer)
    this.tooltip.remove()
    this.map.remove()
  }
}

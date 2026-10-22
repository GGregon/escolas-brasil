import type { StyleSpecification } from 'maplibre-gl'
import bright from './bright.json'

/** Bright/OpenFreeMap, com os rótulos administrativos locais do IBGE. */
export function brightStyle(): StyleSpecification {
  const style = structuredClone(bright) as unknown as StyleSpecification
  // Evita repetir cidades/estados OSM com os municípios oficiais sobrepostos.
  const localPlaces = new Set(['label_village', 'label_town', 'label_state', 'label_city', 'label_city_capital'])
  style.layers = style.layers.filter(layer => !localPlaces.has(layer.id))
  for (const layer of style.layers) {
    // Oculta somente ônibus, preservando estações ferroviárias e aeroportos.
    if (layer.type === 'symbol' && 'source-layer' in layer && ['poi', 'transportation'].includes(layer['source-layer']!)) {
      const keep = ['all', ['!', ['in', ['get', 'class'], ['literal', ['bus','bus_stop','bus_station']]]], ['!=', ['get', 'subclass'], 'bus_stop'], ['!=', ['get', 'subclass'], 'bus_station']]
      layer.filter = (layer.filter ? ['all', layer.filter, keep] : keep) as typeof layer.filter
    }
    if (layer.type === 'line' && layer['source-layer'] === 'transportation' && /^(highway|tunnel|bridge)-/.test(layer.id) && !/railway|path/.test(layer.id)) {
      layer.paint = { ...layer.paint, 'line-color': /casing/.test(layer.id) ? '#c7cecf' : '#f8faf9' }
    }
    if (layer.type === 'symbol' && JSON.stringify(layer.layout?.['text-field'] ?? '').includes('name')) {
      layer.layout!['text-field'] = ['coalesce', ['get', 'name:pt'], ['get', 'name'], ['get', 'name_en']]
    }
  }
  return style
}

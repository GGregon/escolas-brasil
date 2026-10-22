import type { FeatureCollection, Point } from 'geojson'
import type { SchoolRow } from './types'

export type CityResult = {
  kind: 'city'; id: string; name: string; uf: string; coordinates: [number, number]
  bounds?: [number, number, number, number]
}
export type SchoolResult = { kind: 'school'; id: string; name: string; uf: string; city: string; row: SchoolRow }
export type SearchResult = CityResult | SchoolResult
export type SearchFilter = 'all' | 'city' | 'school'
type IndexedResult = { result: SearchResult; name: string; text: string }
export type CityLabels = FeatureCollection<Point, { kind: string; code: string; name: string; uf: string; bounds?: [number, number, number, number] }>

export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function citiesFromLabels(labels: CityLabels): CityResult[] {
  return labels.features.filter(feature => feature.properties.kind === 'municipios').map(feature => ({
    kind: 'city', id: feature.properties.code, name: feature.properties.name, uf: feature.properties.uf,
    coordinates: feature.geometry.coordinates as [number, number], bounds: feature.properties.bounds,
  }))
}

export function createSearchIndex(cities: CityResult[], schools: SchoolRow[]): IndexedResult[] {
  const results: SearchResult[] = [...cities, ...schools.map(row => ({ kind: 'school' as const, id: row[0], name: row[1], city: row[2], uf: row[3], row }))]
  return results.map(result => ({ result, name: normalizeSearch(result.name), text: normalizeSearch(`${result.name} ${result.kind === 'school' ? result.city : ''} ${result.uf}`) }))
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
export function searchPlaces(index: IndexedResult[], query: string, filter: SearchFilter = 'all', limit = 10) {
  const normalized = normalizeSearch(query)
  if (normalized.length < 2) return { results: [] as SearchResult[], total: 0 }
  const words = normalized.split(' ')
  const matches = index.filter(item => (filter === 'all' || item.result.kind === filter) && words.every(word => item.text.includes(word)))
  const score = (item: IndexedResult) => item.name === normalized ? 0 : item.name.startsWith(normalized) ? 1 : words.every(word => item.name.includes(word)) ? 2 : 3
  matches.sort((a, b) => score(a) - score(b)
    || (a.result.kind === b.result.kind ? 0 : a.result.kind === 'city' ? -1 : 1)
    || collator.compare(a.result.name, b.result.name)
    || collator.compare(a.result.uf, b.result.uf)
    || collator.compare(a.result.id, b.result.id))
  return { results: matches.slice(0, limit).map(item => item.result), total: matches.length }
}

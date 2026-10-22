import { describe, expect, it } from 'vitest'
import { createSearchIndex, normalizeSearch, searchPlaces, type CityResult } from './search'
import type { SchoolRow } from './types'

const cities: CityResult[] = [
  { kind: 'city', id: '1', name: 'São Luís', uf: 'MA', coordinates: [-44.3, -2.5] },
  { kind: 'city', id: '2', name: 'Bom Jesus', uf: 'PI', coordinates: [-44.3, -9.0] },
  { kind: 'city', id: '3', name: 'Bom Jesus', uf: 'RS', coordinates: [-50.4, -28.7] },
]
const schools: SchoolRow[] = [
  ['11000001', 'COLÉGIO SÃO JOSÉ', 'São Luís', 'MA', -2.5, -44.3, 'Particular', 'inep', null, null],
  ['11000002', 'ESCOLA BOM JESUS', 'Bom Jesus', 'RS', -28.7, -50.4, 'Particular', 'geocodebr', null, null],
]
const index = createSearchIndex(cities, schools)

describe('Pesquisa local de cidades e escolas', () => {
  it('ignora acentos, caixa e pontuação e exige ao menos dois caracteres', () => {
    expect(normalizeSearch('  SÃO  LUÍS–MA ')).toBe('sao luis ma')
    expect(searchPlaces(index, 's')).toEqual({ results: [], total: 0 })
    expect(searchPlaces(index, 'sao luis').results[0]).toMatchObject({kind:'city',name:'São Luís'})
  })
  it('distingue cidades homônimas pela UF e mantém os identificadores', () => {
    expect(searchPlaces(index, 'bom jesus', 'city').results.map(result => result.id)).toEqual(['2', '3'])
    expect(searchPlaces(index, 'bom jesus rs', 'city').results).toMatchObject([{id:'3',uf:'RS'}])
  })
  it('combina nome da escola, cidade e UF em qualquer ordem', () => {
    const result = searchPlaces(index, 'MA jose colegio').results
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({kind:'school',id:'11000001',row:schools[0]})
    expect(searchPlaces(index, 'sao luis', 'school').results).toHaveLength(1)
  })
  it('prioriza o nome exato, limita sugestões e informa o total de resultados', () => {
    const expanded = createSearchIndex(cities, Array.from({length:30}, (_, i) => [String(i), `ESCOLA ${i}`, 'São Luís', 'MA', -2.5, -44.3, 'Particular', 'inep', null, null] as SchoolRow))
    const found = searchPlaces(expanded, 'sao luis')
    expect(found.total).toBe(31)
    expect(found.results).toHaveLength(10)
    expect(found.results[0]).toMatchObject({kind:'city',name:'São Luís'})
    expect(searchPlaces(index, 'nome inexistente').total).toBe(0)
  })
})

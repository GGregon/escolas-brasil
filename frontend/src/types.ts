import type { FeatureCollection, Geometry } from 'geojson'

export const VARIABLE_KEYS = ['V06001', 'V06002', 'V06003', 'V06004', 'V06005', 'V06006'] as const
export type VariableKey = typeof VARIABLE_KEYS[number]
export interface Variable {
  label: string
  description: string
  unit: string
  breaks: number[]
  available: number
}
export interface Manifest {
  schemaVersion: number
  year: number
  variables: Record<VariableKey, Variable>
  palette: string[]
  missing: string
  imageCoordinates: [[number, number], [number, number], [number, number], [number, number]]
  bounds: [[number, number], [number, number]]
  states: { uf: string; bounds: [number, number, number, number]; count: number }[]
  total: number
  schools: { privadas_ativas: number; mapeadas: number; fora_do_mapa: number }
  boundaries: { estados: number; municipios: number }
}
export type SchoolRow = [string, string, string, string, number, number, string, 'inep' | 'geocodebr' | 'manual', string | null, number | null, (number | null)?]
export interface SchoolsData { ano: number; meta: Manifest['schools']; registros: SchoolRow[] }
export type TractProperties = Record<VariableKey, number | null> & { CD_SETOR: string; NM_MUN: string; sigilo: boolean }
export type TractCollection = FeatureCollection<Geometry, TractProperties>
export interface Layers { tracts: boolean; states: boolean; municipalities: boolean; schools: boolean; approximate: boolean }
export interface ValueRange { min: number; max: number }
export type SectorRow = [string, number | null, number | null, number | null, number | null, number | null, number | null]
export interface SchoolSectors {
  domains: Record<VariableKey, ValueRange>
  schools: Record<string, SectorRow | null>
}
export interface Settings { variable: VariableKey; layers: Layers; range?: ValueRange | null }
export type Selection =
  | { kind: 'tract'; data: TractProperties }
  | { kind: 'school'; data: SchoolRow; others?: SchoolRow[] }
  | { kind: 'boundary'; name: string; code: string; level: 'Estado' | 'Município' }
export interface MapStatus { loading: boolean; message: string; error?: boolean }

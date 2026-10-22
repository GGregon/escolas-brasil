import type { FeatureCollection, Point } from 'geojson'
import { VARIABLE_KEYS, type SchoolRow, type SchoolSectors, type SectorRow, type Settings, type ValueRange, type VariableKey } from './types'

export const GREEN_BLUE = ['#d9f0a3','#addd8e','#78c6a3','#41b6c4','#2c7fb8','#253494']

export function sectorValue(sector: SectorRow | null | undefined, variable: VariableKey): number | null {
  return sector?.[VARIABLE_KEYS.indexOf(variable) + 1] as number | null ?? null
}

export function inRange(value: number | null, range: ValueRange): boolean {
  return value !== null && Number.isFinite(value) && value >= range.min && value <= range.max
}

export function eligibleSchools(rows: SchoolRow[], sectors: SchoolSectors['schools'], settings: Settings): SchoolRow[] {
  return rows.filter(row => (settings.layers.approximate || row[7] !== 'geocodebr') && (!settings.range || inRange(sectorValue(sectors[row[0]], settings.variable), settings.range)))
}

export function schoolFeatures(rows: SchoolRow[]): FeatureCollection<Point> {
  return {type:'FeatureCollection',features:rows.map(row => ({type:'Feature',properties:{code:row[0],approximate:row[7]==='geocodebr',students:row[10] ?? null,missing_students:row[10] == null ? 1 : 0},geometry:{type:'Point',coordinates:[row[5],row[4]]}}))}
}

// Escala não linear para que valores extremos não comprimam as faixas usuais.
export function rangePosition(value: number, domain: ValueRange): number {
  if (domain.max <= domain.min) return 0
  return Math.max(0,Math.min(1000,1000*Math.log1p(Math.max(0,value-domain.min))/Math.log1p(domain.max-domain.min)))
}
export function rangeValue(position: number, domain: ValueRange, variable: VariableKey): number {
  if (position <= 0) return domain.min
  if (position >= 1000) return domain.max
  const value = domain.min + Math.expm1(position/1000*Math.log1p(domain.max-domain.min))
  return variable === 'V06001' || variable === 'V06002' ? Math.round(value) : Math.round(value*100)/100
}

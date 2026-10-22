import type { SchoolRow } from './types'
import { normalizeSearch } from './search'

export const MANUAL_SCHOOLS_KEY = 'renda-mapa.escolas-manuais.v1'

export function makeManualSchool(name: string, latitude: string, longitude: string, existing: SchoolRow[] = []): SchoolRow {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (clean.length < 3 || clean.length > 180) throw new Error('Informe um nome entre 3 e 180 caracteres.')
  const parse = (value: string) => value.trim() ? Number(value.trim().replace(',', '.')) : NaN
  const lat = parse(latitude), lon = parse(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Informe latitude e longitude numéricas, em graus decimais.')
  if (lat < -34 || lat > 6 || lon < -74.1 || lon > -28) throw new Error('As coordenadas ficam fora da área do Brasil. Confira a ordem: latitude, depois longitude.')
  if (existing.some(row => normalizeSearch(row[1]) === normalizeSearch(clean) && Math.abs(row[4] - lat) < .000001 && Math.abs(row[5] - lon) < .000001)) throw new Error('Esta escola já está cadastrada nessa coordenada.')
  return [`local-${crypto.randomUUID()}`, clean, 'Localização informada', '', lat, lon, 'Cadastro manual', 'manual', null, null, null]
}

export function parseManualSchools(text: string): SchoolRow[] {
  const parsed: unknown = JSON.parse(text)
  if (!Array.isArray(parsed) || parsed.length > 10000) throw new Error('Backup inválido: esperado um cadastro de até 10.000 escolas.')
  const rows: SchoolRow[] = []
  const ids = new Set<string>()
  for (const row of parsed) {
    if (!Array.isArray(row) || row.length !== 11 || typeof row[0] !== 'string' || !/^local-[\w-]+$/.test(row[0]) || ids.has(row[0])
      || typeof row[1] !== 'string' || typeof row[4] !== 'number' || typeof row[5] !== 'number' || row[7] !== 'manual') throw new Error('O backup contém um cadastro inválido ou repetido.')
    const validated = makeManualSchool(row[1], String(row[4]), String(row[5]), rows)
    validated[0] = row[0]
    rows.push(validated); ids.add(row[0])
  }
  return rows
}

export function readManualSchools(): { rows: SchoolRow[]; error: string } {
  try { return { rows: parseManualSchools(localStorage.getItem(MANUAL_SCHOOLS_KEY) ?? '[]'), error: '' } }
  catch { return { rows: [], error: 'Não foi possível ler o cadastro local. Exporte ou preserve os dados do navegador antes de substituí-lo.' } }
}

export function saveManualSchools(rows: SchoolRow[]) {
  // Falha de armazenamento deve impedir a confirmação do cadastro, sem perda silenciosa.
  try { localStorage.setItem(MANUAL_SCHOOLS_KEY, JSON.stringify(rows)) }
  catch { throw new Error('Não foi possível salvar neste navegador. Verifique o armazenamento local.') }
}

import type { Manifest, SchoolsData, SchoolSectors } from './types'

const base = `${import.meta.env.BASE_URL}data/`
export const asset = (path: string) => `${base}${path}`

export async function readJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(asset(path), { signal })
  if (!response.ok) throw new Error('Não foi possível carregar os dados do mapa.')
  return response.json() as Promise<T>
}

export async function loadInitialData(signal: AbortSignal) {
  const [manifest, schools, sectors] = await Promise.all([
    readJson<Manifest>('manifest.json', signal),
    readJson<SchoolsData>('escolas.json', signal),
    readJson<SchoolSectors>('escolas_setores.json', signal),
  ])
  return { manifest, schools, sectors }
}

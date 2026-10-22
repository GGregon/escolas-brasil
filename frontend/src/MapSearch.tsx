import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { MapPin, School, Search, X } from 'lucide-react'
import { readJson } from './data'
import { citiesFromLabels, createSearchIndex, searchPlaces, type CityLabels, type CityResult, type SearchFilter, type SearchResult } from './search'
import type { SchoolRow } from './types'

export function MapSearch({ schools, onSelect }: { schools: SchoolRow[]; onSelect: (result: SearchResult) => void }) {
  const [cities, setCities] = useState<CityResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SearchFilter>('all')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const index = useMemo(() => createSearchIndex(cities, schools), [cities, schools])
  const { results, total } = useMemo(() => searchPlaces(index, query, filter), [index, query, filter])
  const selected = useRef<SearchResult | null>(null)

  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [id, active, open, results])

  useEffect(() => {
    const abort = new AbortController()
    setLoading(true); setError(false)
    readJson<CityLabels>('rotulos.geojson', abort.signal).then(labels => setCities(citiesFromLabels(labels))).catch(error => {
      if (error.name !== 'AbortError') setError(true)
    }).finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [retry])

  function choose(result: SearchResult) {
    selected.current = result
    setQuery(result.name); setOpen(false); setActive(0)
    onSelect(result)
  }

  return <section className="panel-section search-section" aria-label="Pesquisa no mapa" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }}>
    <label className="field-label" htmlFor={`${id}-input`}>Pesquisar no mapa</label>
    <form className="search-field" onSubmit={event => {
      event.preventDefault()
      // Enter sempre resolve a consulta atual; depois de escolher um resultado,
      // Enter novamente retorna ao mesmo destino, inclusive entre homônimos.
      const result = !open && selected.current?.name === query ? selected.current : results[active] ?? results[0]
      if (result) choose(result)
    }}>
      <Search size={16} aria-hidden="true" />
      <input id={`${id}-input`} ref={input} type="search" placeholder="Cidade ou escola" autoComplete="off"
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-results` : undefined}
        aria-activedescendant={open && results[active] ? `${id}-option-${active}` : undefined}
        value={query} onFocus={() => setOpen(true)} onChange={event => { selected.current = null; setQuery(event.target.value); setOpen(true); setActive(0) }}
        onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); return }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true)
            setActive(previous => results.length ? (previous + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : 0)
          }
        }} />
      {query && <button type="button" className="icon-button search-clear" onClick={() => { selected.current = null; setQuery(''); setActive(0); setOpen(true); input.current?.focus() }} aria-label="Limpar pesquisa"><X size={14} /></button>}
      <button type="submit" className="search-go" disabled={!results.length} aria-label="Ir para o resultado da pesquisa">Ir</button>
    </form>
    {open && <>
      <div className="search-filters" aria-label="Tipo de resultado">{([['all', 'Tudo'], ['city', 'Cidades'], ['school', 'Escolas']] as const).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setActive(0) }}>{label}</button>)}</div>
      <ul id={`${id}-results`} role="listbox" aria-label="Resultados da pesquisa" className="search-results">
        {results.map((result, position) => <li key={`${result.kind}-${result.id}`} role="presentation">
          <button id={`${id}-option-${position}`} type="button" role="option" aria-selected={active === position} tabIndex={-1}
            onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(position)} onClick={() => choose(result)}>
            {result.kind === 'city' ? <MapPin size={15} aria-hidden="true" /> : <School size={15} aria-hidden="true" />}
            <span><strong>{result.name}</strong><small>{result.kind === 'city' ? `Cidade · ${result.uf}` : [result.city,result.uf,'Escola'].filter(Boolean).join(' · ')}</small></span>
          </button>
        </li>)}
      </ul>
      <p className="search-feedback" role="status">{query.trim().length < 2 ? 'Digite pelo menos 2 caracteres.'
        : total > results.length ? `${total} resultados. Refine a busca pelo nome, cidade ou UF.`
        : total ? `${total} ${total === 1 ? 'resultado' : 'resultados'}.`
        : loading && filter !== 'school' ? 'Carregando cidades…' : 'Nenhum resultado encontrado.'}</p>
      {error && <p className="search-feedback">Não foi possível carregar as cidades. <button type="button" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></p>}
      <p className="search-note">Pesquisa nas escolas com coordenadas disponíveis no mapa.</p>
    </>}
  </section>
}

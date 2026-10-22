import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Grid3X3, Layers, LoaderCircle, MapPin, School, SlidersHorizontal, Square, X } from 'lucide-react'
import { MapController } from './MapController'
import { SchoolPopup } from './SchoolPopup'
import { MapSearch } from './MapSearch'
import type { SearchResult } from './search'
import { ManualSchoolForm } from './ManualSchoolForm'
import { readManualSchools, saveManualSchools } from './manualSchools'
import { loadInitialData } from './data'
import { RangeFilter } from './RangeFilter'
import { associateManualSchools } from './manualSectors'
import { eligibleSchools, sectorValue } from './sectorFilter'
import { formatValue, legendLabels, numbers } from './indicators'
import { VARIABLE_KEYS, type Layers as LayerSettings, type Manifest, type MapStatus, type SchoolsData, type SchoolSectors, type SchoolRow, type SectorRow, type Selection, type Settings, type VariableKey } from './types'

const initialSettings: Settings = { variable: 'V06004', layers: { tracts: true, states: true, municipalities: false, schools: true, approximate: true } }

function Toggle({ label, description, icon, checked, onChange, disabled = false }: {
  label: string; description?: string; icon: ReactNode; checked: boolean; onChange: () => void; disabled?: boolean
}) {
  return <label className={`layer-toggle ${disabled ? 'disabled' : ''}`}>
    <span className="layer-icon" aria-hidden="true">{icon}</span>
    <span className="layer-label">{label}{description && <small>{description}</small>}</span>
    <input type="checkbox" role="switch" checked={checked} onChange={onChange} disabled={disabled} />
    <span className="switch-track" aria-hidden="true" />
  </label>
}

function SelectionCard({ selection, manifest, variable, sector, onClose, onChange }: {
  selection: Selection; manifest: Manifest; variable: VariableKey; sector?:SectorRow|null; onClose: () => void; onChange: (value: Selection) => void
}) {
  const row = selection.kind === 'school' ? selection.data : null
  return <section className="selection-card" aria-label="Detalhes da seleção">
    <div className="section-heading">
      <span>{selection.kind === 'tract' ? 'Setor selecionado' : selection.kind === 'school' ? 'Escola selecionada' : selection.level}</span>
      <button className="icon-button" onClick={onClose} aria-label="Fechar detalhes"><X size={16} /></button>
    </div>
    {selection.kind === 'tract' && <>
      <h2>{selection.data.NM_MUN}</h2>
      <p className="identifier">{selection.data.CD_SETOR}</p>
      <div className="selected-value">{formatValue(selection.data[variable], manifest.variables[variable])}</div>
      <p className="value-label">{manifest.variables[variable].label}</p>
      <dl className="variable-table">
        {VARIABLE_KEYS.map(key => <div key={key} className={key === variable ? 'active' : ''}>
          <dt>{manifest.variables[key].label}</dt><dd>{formatValue(selection.data[key], manifest.variables[key])}</dd>
        </div>)}
      </dl>
      {selection.data.sigilo && <p className="selection-note">Valores suprimidos pelo IBGE</p>}
    </>}
    {selection.kind === 'school' && row && <>
      {selection.others && <label className="field-label">Escolas nesta coordenada
        <select value={row[0]} onChange={event => {
          const next = selection.others!.find(r => r[0] === event.target.value)!
          onChange({ ...selection, data: next })
        }}>{selection.others.map(r => <option key={r[0]} value={r[0]}>{r[1]}</option>)}</select>
      </label>}
      <h2>{row[1]}</h2><p className="location">{[row[2],row[3]].filter(Boolean).join(' · ')}</p>
      <div className="school-tags"><span>{row[6]}</span><span>{row[7] === 'manual' ? 'Informada pelo usuário' : 'Ativa · 2025'}</span></div>
      <dl className="variable-table">
        {row[7] !== 'manual' && <div><dt>Código INEP</dt><dd>{row[0]}</dd></div>}
        <div><dt>{row[7] === 'manual' ? 'Matrículas' : 'Matrículas · 2025'}</dt><dd>{row[10] == null ? 'Não informado' : numbers.format(row[10])}</dd></div>
        <div><dt>Coordenadas</dt><dd>{row[7] === 'inep' ? 'Originais INEP' : row[7] === 'manual' ? 'Informadas manualmente' : 'Geocodificadas'}</dd></div>
        <div><dt>Setor da coordenada</dt><dd>{sector?.[0] ?? 'Não associado'}</dd></div>
        <div><dt>{manifest.variables[variable].label} do setor</dt><dd>{formatValue(sectorValue(sector,variable),manifest.variables[variable])}</dd></div>
        {row[7] === 'manual' && <div><dt>Latitude / longitude</dt><dd>{row[4]}, {row[5]}</dd></div>}
        {row[7] === 'geocodebr' && <>
          <div><dt>Localização</dt><dd>{({ numero: 'Número', numero_aproximado: 'Número aproximado', logradouro: 'Logradouro' } as Record<string, string>)[row[8]!] ?? row[8]}</dd></div>
          {row[9] !== null && <div><dt>Desvio reportado</dt><dd>{numbers.format(row[9])} m</dd></div>}
        </>}
      </dl>
      {row[7] === 'geocodebr' && <p className="selection-note">Posição aproximada</p>}
      <p className="selection-note">{row[7] === 'manual' ? 'Cadastro local, sem validação ou vínculo automático com o INEP.' : 'QT_MAT_BAS: matrículas da educação básica, não alunos únicos.'}</p>
    </>}
    {selection.kind === 'boundary' && <><h2>{selection.name}</h2><p className="identifier">IBGE {selection.code}</p></>}
  </section>
}

export default function App() {
  const [data, setData] = useState<{ manifest: Manifest; schools: SchoolsData; sectors: SchoolSectors } | null>(null)
  const [settings, setSettings] = useState<Settings>(initialSettings)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [status, setStatus] = useState<MapStatus>({ loading: true, message: 'Preparando o mapa' })
  const [collapsed, setCollapsed] = useState(false)
  const [manual, setManual] = useState(readManualSchools)
  const allSchools = useMemo(() => [...(data?.schools.registros ?? []), ...manual.rows], [data, manual.rows])
  const [manualSectors,setManualSectors]=useState<SchoolSectors['schools']>({})
  const [sectorLoading,setSectorLoading]=useState(false)
  const [sectorError,setSectorError]=useState(false)
  const [sectorRetry,setSectorRetry]=useState(0)
  const sectorLookup=useMemo(()=>({...data?.sectors.schools,...manualSectors}),[data,manualSectors])
  const visibleSchools=useMemo(()=>eligibleSchools(allSchools,sectorLookup,settings),[allSchools,sectorLookup,settings])
  const container = useRef<HTMLDivElement>(null)
  const controller = useRef<MapController | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    loadInitialData(abort.signal).then(setData).catch(error => {
      if (error.name !== 'AbortError') setStatus({ loading: false, message: 'Não foi possível abrir os dados do mapa. Recarregue a página.', error: true })
    })
    return () => abort.abort()
  }, [])

  useEffect(() => {
    if (!data || !container.current) return
    try {
      controller.current = new MapController(container.current, data.manifest, data.schools, settings, setSelection, setStatus)
    } catch (error) {
      console.error(error)
      setStatus({ loading: false, message: 'O navegador não conseguiu iniciar o mapa. Verifique o suporte a WebGL.', error: true })
    }
    return () => { controller.current?.destroy(); controller.current = null }
    // Settings are synchronized without recreating the WebGL map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  useEffect(() => { controller.current?.update(settings) }, [settings])
  useEffect(() => { controller.current?.setManualSchools(manual.rows) }, [manual.rows, data])
  useEffect(() => { controller.current?.setSectorLookup(sectorLookup) }, [sectorLookup,data])
  useEffect(() => {
    if (!data || !manual.rows.length) {setManualSectors({});setSectorLoading(false);setSectorError(false);return}
    let active=true
    setSectorLoading(true);setSectorError(false)
    associateManualSchools(manual.rows,data.manifest).then(lookup=>{
      if (active) setManualSectors(lookup)
    }).catch(()=>{if(active)setSectorError(true)}).finally(()=>{if(active)setSectorLoading(false)})
    return ()=>{active=false}
  },[data,manual.rows,sectorRetry])

  function toggle(key: keyof LayerSettings) {
    setSettings(previous => ({ ...previous, layers: { ...previous.layers, [key]: !previous.layers[key] } }))
  }

  function locate(result: SearchResult) {
    if (result.kind === 'school') {
      const next = { ...settings, layers: { ...settings.layers, schools: true, approximate: settings.layers.approximate || result.row[7] === 'geocodebr' } }
      setSettings(next)
      controller.current?.update(next)
    }
    controller.current?.focusSearch(result)
    if (window.innerWidth < 760) setCollapsed(true)
  }

  function locateSchool(row: SchoolRow) {
    locate({kind:'school',id:row[0],name:row[1],city:row[2],uf:row[3],row})
  }

  function saveManual(next: SchoolRow[], added?: SchoolRow) {
    if (manual.error) throw new Error(manual.error)
    if (next.length > 10000) throw new Error('O limite é de 10.000 cadastros manuais.')
    saveManualSchools(next)
    setManual({rows:next,error:''})
    controller.current?.setManualSchools(next)
    if (added) locateSchool(added)
  }

  const variable = data?.manifest.variables[settings.variable]
  const labels = variable ? legendLabels(variable) : []
  const selectionCard = selection && data && <SelectionCard selection={selection} manifest={data.manifest} variable={settings.variable}
    sector={selection.kind==='school' ? sectorLookup[selection.data[0]] : null}
    onClose={() => controller.current?.clearSelection()} onChange={next => controller.current?.select(next)} />
  return <main className="app-shell">
    <div ref={container} className="map-canvas" aria-label="Mapa interativo de setores censitários e escolas privadas do Brasil" role="region" />
    <aside className={`control-panel ${collapsed ? 'collapsed' : ''}`} aria-label="Controles e legenda do mapa">
      <div className="panel-heading">
        <div className="panel-title"><span className="panel-icon"><SlidersHorizontal size={17} /></span><h1>Visualização</h1></div>
        <button className="icon-button collapse-button" aria-expanded={!collapsed} aria-controls="panel-content" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Abrir controles' : 'Recolher controles'}>
          {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      <div id="panel-content" hidden={collapsed}>
        {data && <MapSearch schools={settings.range ? visibleSchools : allSchools} onSelect={locate} />}
        {data && <ManualSchoolForm rows={manual.rows} allSchools={allSchools} storageError={manual.error} onSave={saveManual} onLocate={locateSchool} />}
        <section className="panel-section indicator-section">
          <label className="field-label" htmlFor="variable">Indicador do Censo</label>
          <div className="select-wrap"><select id="variable" value={settings.variable} disabled={!data} onChange={event => {
            const key=event.target.value as VariableKey
            setSettings(previous=>({...previous,variable:key,range:previous.range && data ? {...data.sectors.domains[key]} : null}))
          }}>
            {data ? VARIABLE_KEYS.map(key => <option key={key} value={key}>{data.manifest.variables[key].label}</option>) : <option value="V06004">Carregando indicadores…</option>}
          </select><ChevronDown size={16} aria-hidden="true" /></div>
          <div className="field-meta"><span>{settings.variable}</span><span>{variable?.unit ?? 'R$'} · 2022</span></div>
          {data && variable && <RangeFilter variableKey={settings.variable} variable={variable} domain={data.sectors.domains[settings.variable]}
            range={settings.range} onChange={range=>setSettings(previous=>({...previous,range}))} />}
          {settings.range && sectorLoading && <p className="search-note" role="status">Associando cadastros manuais aos setores…</p>}
          {sectorError && <p className="form-error" role="alert">Não foi possível associar os cadastros manuais aos setores. <button type="button" onClick={()=>setSectorRetry(value=>value+1)}>Tentar novamente</button></p>}
        </section>
        <section className="panel-section" aria-label="Camadas">
          <h2 className="section-heading">Camadas</h2>
          <Toggle label="Setores censitários" icon={<Layers size={17} />} checked={settings.layers.tracts} onChange={() => toggle('tracts')} />
          <Toggle label="Estados" icon={<Square size={17} />} checked={settings.layers.states} onChange={() => toggle('states')} />
          <Toggle label="Municípios" icon={<Grid3X3 size={17} />} checked={settings.layers.municipalities} onChange={() => toggle('municipalities')} />
          <Toggle label="Escolas privadas" description="Censo Escolar · 2025" icon={<School size={18} />} checked={settings.layers.schools} onChange={() => toggle('schools')} />
          <Toggle label="Incluir geocodificadas" icon={<MapPin size={16} />} checked={settings.layers.approximate} disabled={!settings.layers.schools} onChange={() => toggle('approximate')} />
        </section>
        {data && variable && settings.layers.tracts && <section className="panel-section legend" aria-label="Legenda do indicador">
          <div className="section-heading"><span>{variable.label}</span><span className="legend-unit">{variable.unit}</span></div>
          <div className="legend-ramp" aria-hidden="true">{data.manifest.palette.map(color => <span key={color} style={{ background: color }} />)}</div>
          <ul className="legend-list">{labels.map((label, index) => <li key={label}><span className="color-key" style={{ background: data.manifest.palette[index] }} />{label}</li>)}<li><span className="color-key missing-key" style={{ background: data.manifest.missing }} />Sem informação</li></ul>
          <p className="search-note">Verde: menor {['V06004','V06006'].includes(settings.variable) ? 'renda' : 'valor'} · Azul: maior {['V06004','V06006'].includes(settings.variable) ? 'renda' : 'valor'}</p>
        </section>}
        {settings.layers.schools && data && <div className="schools-key"><span className="school-dot" /><span>{numbers.format(visibleSchools.length)} {settings.range ? 'escolas no intervalo' : 'escolas'}<br /><small>{numbers.format(visibleSchools.reduce((sum,row)=>sum+(row[10]??0),0))} matrículas informadas.<br />Círculos: área proporcional às matrículas.<br />Agrupamentos: escala reduzida, até 48 px.<br />Sem total: marcador de referência.</small></span></div>}
        {selection?.kind !== 'school' && selectionCard}
      </div>
    </aside>
    {selection?.kind === 'school' && controller.current && <SchoolPopup map={controller.current.map}
      coordinates={[selection.data[5], selection.data[4]]} onClose={() => controller.current?.clearSelection()}>
      {selectionCard}
    </SchoolPopup>}
    {status.message && <div className={`map-status ${status.error ? 'error' : ''}`} role="status" aria-live="polite">
      {status.loading && <LoaderCircle size={15} className="spinner" />}<span>{status.message}</span>
    </div>}
  </main>
}

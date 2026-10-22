import { useRef, useState } from 'react'
import { makeManualSchool, parseManualSchools } from './manualSchools'
import type { SchoolRow } from './types'

export function ManualSchoolForm({ rows, allSchools, storageError, onSave, onLocate }: {
  rows: SchoolRow[]; allSchools: SchoolRow[]; storageError: string
  onSave: (next: SchoolRow[], added?: SchoolRow) => void; onLocate: (row: SchoolRow) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(''), [lat, setLat] = useState(''), [lon, setLon] = useState('')
  const [error, setError] = useState(''), [message, setMessage] = useState('')
  const file = useRef<HTMLInputElement>(null)
  function persist(next: SchoolRow[], added?: SchoolRow) {
    onSave(next, added)
    setError('')
  }
  return <section className="panel-section manual-section">
    <button className="manual-heading" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>Adicionar escola <span>{open ? '−' : '+'}</span></button>
    {open && <>
      <p className="search-note">Informe as coordenadas manualmente. Os cadastros ficam salvos somente neste navegador.</p>
      {storageError && <p className="form-error" role="alert">{storageError}</p>}
      <form onSubmit={event => {
        event.preventDefault()
        try {
          if (storageError) throw new Error(storageError)
          const row = makeManualSchool(name, lat, lon, allSchools)
          persist([...rows, row], row)
          setName(''); setLat(''); setLon(''); setMessage('Escola salva. O mapa foi direcionado para a coordenada; a exibição respeita o filtro ativo.')
        } catch (error) { setError((error as Error).message); setMessage('') }
      }}>
        <label className="field-label">Nome da escola<input required maxLength={180} value={name} onChange={event => setName(event.target.value)} /></label>
        <div className="coordinate-fields">
          <label className="field-label">Latitude<input required inputMode="decimal" placeholder="−23.5505" value={lat} onChange={event => setLat(event.target.value)} /></label>
          <label className="field-label">Longitude<input required inputMode="decimal" placeholder="−46.6333" value={lon} onChange={event => setLon(event.target.value)} /></label>
        </div>
        <button type="submit" className="manual-save" disabled={!!storageError}>Salvar e mostrar no mapa</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="search-feedback" role="status">{message}</p>}
      <div className="manual-backup">
        <button type="button" disabled={!rows.length} onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], {type:'application/json'}))
          const link = document.createElement('a'); link.href = url; link.download = 'escolas-manuais.json'; link.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }}>Exportar backup</button>
        <button type="button" disabled={!!storageError} onClick={() => file.current?.click()}>Importar backup</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={async event => {
          const selected = event.target.files?.[0]; event.target.value = ''
          if (!selected) return
          try {
            if (selected.size > 5_000_000) throw new Error('O backup deve ter até 5 MB.')
            const imported = parseManualSchools(await selected.text())
            const next = [...rows]
            for (const row of imported) {
              if (next.some(old => old[0] === row[0])) continue
              const checked = makeManualSchool(row[1], String(row[4]), String(row[5]), [...allSchools, ...next])
              checked[0] = row[0]; next.push(checked)
            }
            if (next.length > 10000) throw new Error('O limite é de 10.000 cadastros manuais.')
            persist(next); setMessage(`${next.length - rows.length} escolas importadas.`)
          } catch (error) { setError((error as Error).message); setMessage('') }
        }} />
      </div>
      {!!rows.length && <ul className="manual-list">{rows.map(row => <li key={row[0]}>
        <button type="button" onClick={() => onLocate(row)}>{row[1]}</button>
        <button type="button" aria-label={`Excluir cadastro ${row[1]}`} onClick={() => {
          try { persist(rows.filter(other => other[0] !== row[0])); setMessage('Cadastro removido.') }
          catch (error) { setError((error as Error).message) }
        }}>Excluir</button>
      </li>)}</ul>}
    </>}
  </section>
}

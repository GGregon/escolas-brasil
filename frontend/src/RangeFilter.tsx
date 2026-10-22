import { formatValue } from './indicators'
import { rangePosition, rangeValue } from './sectorFilter'
import type { ValueRange, Variable, VariableKey } from './types'

export function RangeFilter({ variableKey, variable, domain, range, onChange }: {
  variableKey:VariableKey; variable:Variable; domain:ValueRange
  range:ValueRange|null|undefined; onChange:(value:ValueRange|null)=>void
}) {
  const current=range ?? domain
  const lower=rangePosition(current.min,domain)
  const upper=rangePosition(current.max,domain)
  function setBound(key:'min'|'max',value:number) {
    if (!Number.isFinite(value)) return
    const bounded=Math.max(domain.min,Math.min(domain.max,value))
    onChange(key==='min' ? {min:Math.min(bounded,current.max),max:current.max} : {min:current.min,max:Math.max(bounded,current.min)})
  }
  return <div className="range-filter">
    <label className="range-enable"><input type="checkbox" checked={!!range} onChange={event => onChange(event.target.checked ? {...domain} : null)} />Filtrar escolas pelo setor</label>
    {range && <>
      <p className="range-caption">{variable.label} · {variable.unit}</p>
      <div className="range-readout">
        <span><small>Mínimo</small>{formatValue(current.min,variable)}</span>
        <span><small>Máximo</small>{formatValue(current.max,variable)}</span>
      </div>
      <div className="range-dual" role="group" aria-label="Intervalo do indicador">
        <div className="range-track" aria-hidden="true" onPointerDown={event=>{
          if(event.button!==0)return
          const rect=event.currentTarget.getBoundingClientRect()
          const position=Math.max(0,Math.min(1000,(event.clientX-rect.left)/rect.width*1000))
          setBound(Math.abs(position-lower)<=Math.abs(position-upper)?'min':'max',rangeValue(position,domain,variableKey))
        }}><span style={{left:`${lower/10}%`,width:`${(upper-lower)/10}%`}} /></div>
        <input type="range" min={0} max={1000} step={1} value={lower} style={{zIndex:lower>990?3:1}}
          onChange={event => setBound('min',rangeValue(Number(event.target.value),domain,variableKey))}
          aria-label="Limite mínimo do indicador" aria-valuetext={formatValue(current.min,variable)} />
        <input type="range" min={0} max={1000} step={1} value={upper} style={{zIndex:upper<10?3:2}}
          onChange={event => setBound('max',rangeValue(Number(event.target.value),domain,variableKey))}
          aria-label="Limite máximo do indicador" aria-valuetext={formatValue(current.max,variable)} />
      </div>
      <button type="button" className="range-reset" onClick={() => onChange(null)}>Limpar filtro</button>
      <p className="search-note">Intervalo inclusivo. Setores fora da faixa ficam mais discretos. A renda é do setor da coordenada, não dos alunos ou da escola. Sem setor único ou valor publicado, a escola fica fora do filtro.</p>
    </>}
  </div>
}

import { describe, expect, it } from 'vitest'
import type { SchoolRow, SectorRow, Settings } from './types'
import { eligibleSchools, inRange, rangePosition, rangeValue, schoolFeatures, sectorValue } from './sectorFilter'
import { strictlyContains } from './manualSectors'

const settings:Settings={variable:'V06004',layers:{tracts:true,states:true,municipalities:false,schools:true,approximate:true},range:{min:3000,max:8000}}
const row=(id:string,origin:SchoolRow[7]='inep'):SchoolRow=>[id,id,'Cidade','SP',-23.55,-46.63,'Particular',origin,null,null,100]
const sector=(value:number|null):SectorRow=>['350000000000001',10,20,1,value,100,2000]

describe('Intervalo do setor das escolas',()=>{
  it('inclui os dois limites e diferencia zero, ausência e setor não associado',()=>{
    expect(inRange(3000,settings.range!)).toBe(true)
    expect(inRange(8000,settings.range!)).toBe(true)
    expect(inRange(8000.01,settings.range!)).toBe(false)
    expect(inRange(null,{min:0,max:0})).toBe(false)
    expect(inRange(0,{min:0,max:0})).toBe(true)
    const rows=[row('min'),row('max'),row('outside'),row('suppressed'),row('unmatched')]
    const lookup={min:sector(3000),max:sector(8000),outside:sector(9000),suppressed:sector(null),unmatched:null}
    expect(eligibleSchools(rows,lookup,settings).map(row=>row[0])).toEqual(['min','max'])
    expect(eligibleSchools(rows,lookup,{...settings,range:null})).toHaveLength(5)
  })
  it('usa o indicador escolhido, aplica a mesma regra a manuais e respeita geocodificadas',()=>{
    const rows=[row('official'),row('local-test','manual'),row('geocoded','geocodebr')]
    const lookup=Object.fromEntries(rows.map(row=>[row[0],sector(5000)]))
    const visible=eligibleSchools(rows,lookup,{...settings,layers:{...settings.layers,approximate:false}})
    expect(visible.map(row=>row[0])).toEqual(['official','local-test'])
    expect(eligibleSchools(rows,lookup,{...settings,variable:'V06002',range:{min:0,max:15}})).toHaveLength(0)
    expect(sectorValue(sector(5000),'V06002')).toBe(20)
    expect(schoolFeatures(visible).features.reduce((sum,f)=>sum+Number(f.properties!.students),0)).toBe(200)
  })
  it('mantém extremos e permite faixas usuais mesmo com valores máximos muito grandes',()=>{
    const domain={min:80,max:177068.09}
    expect(rangeValue(0,domain,'V06004')).toBe(80)
    expect(rangeValue(1000,domain,'V06004')).toBe(domain.max)
    expect(rangeValue(rangePosition(3000,domain),domain,'V06004')).toBe(3000)
    expect(rangeValue(rangePosition(8000,domain),domain,'V06004')).toBe(8000)
  })
})

describe('Associação espacial dos cadastros manuais',()=>{
  const geometry={type:'Polygon' as const,coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]}
  it('exclui pontos fora, em buracos e sobre divisas, sem escolher o setor mais próximo',()=>{
    expect(strictlyContains(geometry,[2,2])).toBe(true)
    expect(strictlyContains(geometry,[11,2])).toBe(false)
    expect(strictlyContains(geometry,[5,5])).toBe(false)
    expect(strictlyContains(geometry,[0,2])).toBe(false)
    expect(strictlyContains(geometry,[4,5])).toBe(false)
  })
  it('trata todas as partes de um setor multipolígono',()=>{
    expect(strictlyContains({type:'MultiPolygon',coordinates:[geometry.coordinates,[[[20,20],[22,20],[22,22],[20,22],[20,20]]]]},[21,21])).toBe(true)
  })
})

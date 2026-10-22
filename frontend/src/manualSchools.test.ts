import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeManualSchool, parseManualSchools, readManualSchools, saveManualSchools, MANUAL_SCHOOLS_KEY } from './manualSchools'

beforeEach(() => {
  const stored = new Map<string,string>()
  vi.stubGlobal('localStorage', {getItem:(key:string) => stored.get(key) ?? null, setItem:(key:string,value:string) => stored.set(key,value)})
})

describe('Cadastro manual de escolas', () => {
  it('aceita graus decimais com vírgula e preserva a ausência de matrículas', () => {
    const row = makeManualSchool('  Escola   São José ', '-23,55', '-46.63')
    expect(row.slice(1,2)).toEqual(['Escola São José'])
    expect(row.slice(4,6)).toEqual([-23.55,-46.63])
    expect(row[7]).toBe('manual')
    expect(row[10]).toBeNull()
    expect(() => makeManualSchool('Escola Sao Jose','-23.55','-46.63',[row])).toThrow('já está cadastrada')
  })
  it('rejeita campos vazios, coordenadas trocadas e valores fora do mapa', () => {
    expect(() => makeManualSchool('AB','','-46')).toThrow()
    expect(() => makeManualSchool('Escola','', '-46')).toThrow()
    expect(() => makeManualSchool('Escola','-46','-23')).toThrow()
    expect(() => makeManualSchool('Escola','Infinity','-46')).toThrow()
  })
  it('restaura o mesmo cadastro e identificador após salvar ou importar backup', () => {
    const rows = [makeManualSchool('Escola local','-15.8','-47.9')]
    saveManualSchools(rows)
    expect(readManualSchools()).toEqual({rows,error:''})
    expect(parseManualSchools(JSON.stringify(rows))).toEqual(rows)
    expect(() => parseManualSchools(JSON.stringify([...rows,...rows]))).toThrow()
    expect(() => parseManualSchools(JSON.stringify([[...rows[0].slice(0,7),'inep',null,null,null]]))).toThrow()
  })
  it('não sobrescreve armazenamento corrompido e informa falhas de gravação', () => {
    localStorage.setItem(MANUAL_SCHOOLS_KEY,'arquivo inválido')
    expect(readManualSchools().error).not.toBe('')
    expect(localStorage.getItem(MANUAL_SCHOOLS_KEY)).toBe('arquivo inválido')
    vi.stubGlobal('localStorage',{setItem:() => {throw new Error('quota')}})
    expect(() => saveManualSchools([])).toThrow('Não foi possível salvar')
  })
})

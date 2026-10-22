import { describe, expect, it } from 'vitest'
import { classIndex, fillExpression, formatValue, intersects } from './indicators'

const variable = { label: 'Renda', description: '', unit: 'R$', breaks: [1212, 2424, 4848], available: 1 }

describe('Valores e classes do Censo', () => {
  it('distingue renda zero de ausência e respeita os limites inclusivos do raster', () => {
    expect(classIndex(null, variable.breaks)).toBe(-1)
    expect(classIndex(0, variable.breaks)).toBe(0)
    expect(classIndex(1212, variable.breaks)).toBe(0)
    expect(classIndex(1212.01, variable.breaks)).toBe(1)
    expect(classIndex(9000, variable.breaks)).toBe(3)
    expect(formatValue(null, variable)).toBe('Sem informação')
    expect(formatValue(0, variable)).toContain('0,00')
  })
  it('usa comparação inclusiva também nos polígonos e formata variância sem tratá-la como renda', () => {
    const expression = fillExpression('V06004', variable, ['a','b','c','d'], 'nulo')
    expect(expression).toContainEqual(['<=', ['get', 'V06004'], 1212])
    expect(formatValue(2500000, { ...variable, unit: 'R$²' })).toBe('2.500.000 R$²')
    expect(formatValue(1.25, { ...variable, unit: 'moradores²' })).toBe('1,25 moradores²')
  })
  it('inclui setores sobre a borda da janela e descarta regiões distantes', () => {
    expect(intersects([0,0,1,1], [1,1,2,2])).toBe(true)
    expect(intersects([0,0,1,1], [2,2,3,3])).toBe(false)
  })
})

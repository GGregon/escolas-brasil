import { describe, expect, it } from 'vitest'
import { createExpression } from '@maplibre/maplibre-gl-style-spec'
import { schoolRadius } from './schoolStyle'
import { brightStyle } from './basemap'

describe('Representação de matrículas e fundo', () => {
  it('quadruplica a área quando as matrículas quadruplicam e não estima ausências', () => {
    const parsed = createExpression(schoolRadius, 'layers[0].paint.circle-radius')
    if (parsed.result !== 'success') throw new Error('Expressão de raio inválida')
    const radius = (students:number|null) => parsed.value.evaluate({zoom:14},{type:'Point',properties:{students}})
    expect(radius(400) ** 2 / radius(100) ** 2).toBeCloseTo(4)
    expect(radius(null)).toBe(3)
    expect(radius(0)).toBe(3)
  })
  it('retira ônibus e neutraliza avenidas, mantendo trilhos e vias identificadas', () => {
    const style = brightStyle()
    const transit = style.layers.find(layer => layer.id === 'poi_transit')
    expect(JSON.stringify(transit)).toContain('bus_stop')
    for (const id of ['highway-primary','highway-secondary-tertiary','highway-motorway','bridge-motorway']) {
      expect(style.layers.find(layer => layer.id === id)).toMatchObject({paint:{'line-color':'#f8faf9'}})
    }
    expect(style.layers.find(layer => layer.id === 'railway')).toBeDefined()
  })
})

import type { ExpressionSpecification } from 'maplibre-gl'
import type { Variable, VariableKey } from './types'

export const numbers = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })

export function formatValue(value: number | null, variable: Variable): string {
  if (value === null || !Number.isFinite(value)) return 'Sem informação'
  if (variable.unit === 'R$') return money.format(value)
  if (variable.unit === 'R$²' || variable.unit === 'moradores²') return `${numbers.format(value)} ${variable.unit}`
  return numbers.format(value)
}

export function classIndex(value: number | null, breaks: number[]): number {
  if (value === null || !Number.isFinite(value)) return -1
  const index = breaks.findIndex(limit => value <= limit)
  return index === -1 ? breaks.length : index
}

export function fillExpression(key: VariableKey, variable: Variable, palette: string[], missing: string): ExpressionSpecification {
  const expression: unknown[] = ['case', ['==', ['get', key], null], missing]
  variable.breaks.forEach((limit, index) => expression.push(['<=', ['get', key], limit], palette[index]))
  expression.push(palette[palette.length - 1])
  return expression as ExpressionSpecification
}

export function legendLabels(variable: Variable): string[] {
  const labels = variable.breaks.map((limit, index) => index === 0
    ? `Até ${numbers.format(limit)}`
    : `${numbers.format(variable.breaks[index - 1])} – ${numbers.format(limit)}`)
  labels.push(`Acima de ${numbers.format(variable.breaks.at(-1)!)}`)
  return labels
}

export function intersects(a: number[], b: number[]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}

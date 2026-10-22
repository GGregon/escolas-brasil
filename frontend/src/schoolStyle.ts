import type { ExpressionSpecification } from 'maplibre-gl'

// Área do círculo proporcional às matrículas (raio = 0,4 × raiz do total).
// Ausência/zero usam um pequeno marcador de referência, sem estimar matrículas.
export const schoolRadius: ExpressionSpecification = ['case', ['>', ['coalesce', ['get', 'students'], 0], 0], ['*', .4, ['sqrt', ['get', 'students']]], 3]
export const clusterRadius: ExpressionSpecification = ['min', 48, ['max', 6, ['*', .08, ['sqrt', ['coalesce', ['get', 'students'], 0]]]]]

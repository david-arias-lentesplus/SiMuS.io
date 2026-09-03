// Hefesto — espejo en hex de los tokens de tailwind.config.js que Chart.js
// necesita como valores literales (Chart.js no lee clases de Tailwind).
// Regla dura de Hefesto: cero valores "mágicos" — estos hex DEBEN coincidir
// siempre con tailwind.config.js; si cambia un color de marca ahí, hay que
// actualizarlo acá también. Ver tokens/README.md.
export const CHART_COLORS = {
  smsSentBar: '#4F46E5', // brand.indigo
  smsSentBarBg: 'rgba(79, 70, 229, 0.15)',
  roiLine: '#14B8A6', // brand.teal
  roiLineBg: 'rgba(20, 184, 166, 0.15)',
  grid: '#D3D5E0', // ink.300
  tick: '#6B6F85', // ink.500

  // Fase 2.7 (2026-09-03, "COMPLETITUD DE DASHBOARD"): tokens para las dos
  // gráficas nuevas del Dashboard Global — Evolución mensual del canal
  // (barras de ganancia incremental + línea de ROI incremental) y
  // Rendimiento geográfico (barras horizontales por país).
  gainBar: '#16A34A', // state.success
  gainBarBg: 'rgba(22, 163, 74, 0.15)',
  roiLineIncremental: '#4F46E5', // brand.indigo
  roiLineIncrementalBg: 'rgba(79, 70, 229, 0.15)',
  geoBar: '#2E1A73', // blue-deep
  geoBarBg: 'rgba(46, 26, 115, 0.85)',
};

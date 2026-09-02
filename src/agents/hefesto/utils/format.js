// Hefesto — helpers de formato puros (sin dependencias de datos ni estado).
// Migrados 1:1 desde las funciones fmt$/fmtN/fmtPct/fmtDateShort del
// prototipo HTML original para mantener el mismo formato que ya conocía
// el usuario.

export function fmtN(n, decimals = 0) {
  if (n == null || Number.isNaN(n)) return '-';
  return Number(n).toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmt$(n) {
  if (n == null || Number.isNaN(n)) return '-';
  return '$' + fmtN(n, 2);
}

export function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return '-';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function fmtDateShort(iso) {
  if (!iso) return '-';
  const [datePart] = iso.split('T');
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Redondea a 2 decimales. Fase 3 (2026-09-02, "Corrección de Decimales",
 * QA reportó inputs numéricos mostrando basura de punto flotante como
 * "13084,510000000002"). fmt$/fmtN ya redondeaban correctamente para
 * VISTAS de solo lectura (toLocaleString con maximumFractionDigits), pero
 * los <input type="number"> editables de CampaignForm.jsx muestran el
 * valor crudo del estado sin pasar por esos formatters — este helper se
 * usa para limpiar el valor en el origen (useCampaignCalculator.js, al
 * recibir totalSales de Metabase) y como red de seguridad en el propio
 * input (onBlur, ver NumberField en CampaignForm.jsx).
 */
export function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

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

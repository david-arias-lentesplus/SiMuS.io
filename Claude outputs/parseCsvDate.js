// Minerva — intenta convertir el valor crudo de fecha que llega de
// `sms_processed_campaigns` (`communication_start_date`/`send_date`) al
// formato 'YYYY-MM-DD' que espera el <input type="date"> de la
// Calculadora.
//
// FIX (sesión "CORRECCIÓN FASE 2.4 — DEBUGGING DE UI Y PARSEO DE DATOS"):
// desde esa sesión, Éter normaliza la fecha a 'YYYY-MM-DD' ANTES de
// guardarla (ver eter/utils/parseWorkingbitsDate.js) — para campañas
// cargadas de ahí en adelante, esta función solo necesita el camino ISO
// (rama 1) y ya está. Se mantiene el fallback DD/MM/YYYY explícito (rama
// 2, agregado en esta misma sesión) para no dejar en blanco la fecha de
// campañas cargadas ANTES del fix, que pueden tener el valor crudo del
// CSV (`DD/MM/YYYY HH:mm:ss`, formato real confirmado por el usuario) sin
// normalizar todavía en Supabase.
//
// Estrategia, en orden:
//   1. Si ya empieza con YYYY-MM-DD (ISO — el caso normal desde el fix de
//      Éter), se toman esos 10 caracteres.
//   2. Si tiene forma DD/MM/YYYY (con o sin hora) — dato viejo, cargado
//      antes del fix de Éter — se interpreta explícitamente en ese orden
//      (NUNCA con `new Date()`, que asumiría MM/DD/YYYY y daría un
//      resultado incorrecto o inválido para este formato).
//   3. Si nada de lo anterior aplica, se delega a `new Date(raw)` como
//      último recurso genérico (cubre otros formatos no previstos).
//   4. Si nada produce una fecha válida, se devuelve '' — el campo queda
//      vacío en vez de adivinar un valor incorrecto.
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DDMMYYYY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/;

export function parseCsvDate(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';

  const isoMatch = value.match(ISO_RE);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const ddmmyyyyMatch = value.match(DDMMYYYY_RE);
  if (ddmmyyyyMatch) {
    const [, dd, mm, yyyy] = ddmmyyyyMatch;
    const day = Number(dd);
    const month = Number(mm);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return '';
}

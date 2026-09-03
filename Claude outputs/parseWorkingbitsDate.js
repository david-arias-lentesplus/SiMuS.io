// Éter — normaliza fechas crudas del CSV de Workingbits al formato
// 'YYYY-MM-DD' que espera el <input type="date"> de la Calculadora.
//
// FIX (sesión "CORRECCIÓN FASE 2.4 — DEBUGGING DE UI Y PARSEO DE DATOS"):
// el usuario confirmó, revisando la base de datos real, que el CSV trae
// las fechas (`Send At`, `Communication Start Date`) en formato
// `DD/MM/YYYY HH:mm:ss`. El código anterior guardaba el valor CRUDO tal
// cual venía del CSV y dejaba que `parseCsvDate.js` (Minerva) lo
// interpretara recién al mostrarlo en la Calculadora — pero
// `new Date('03/09/2026 14:30:00')` en JavaScript asume MM/DD/YYYY (orden
// estadounidense), no DD/MM/YYYY, así que para cualquier día > 12
// devolvía una fecha inválida (`NaN`) y el campo se quedaba vacío; para
// días ≤ 12 devolvía una fecha SILENCIOSAMENTE INCORRECTA (día y mes
// invertidos), peor que un campo vacío porque no se nota a simple vista.
//
// Por eso ahora Éter parsea y normaliza la fecha ACÁ, antes de guardarla
// en el estado/Supabase (ver parseWorkingbitsCsv.js) — nunca se guarda
// una fecha ambigua esperando que alguien más la interprete bien después.
//
// A diferencia de src/agents/minerva/utils/parseCsvDate.js (que asume
// MM/DD/YYYY vía `new Date()` como fallback genérico, útil para otros
// formatos), esta función asume EXPLÍCITAMENTE DD/MM/YYYY porque el
// usuario confirmó ese es el formato real de Workingbits — no es una
// suposición genérica, es el formato verificado de esta fuente concreta.
const DDMMYYYY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * @param {string} raw Valor crudo de `Send At` / `Communication Start Date` del CSV.
 * @returns {string} 'YYYY-MM-DD', o '' si no se pudo interpretar (nunca se adivina un valor incorrecto).
 */
export function parseWorkingbitsDate(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';

  // Ya viene en ISO (por si Workingbits cambia de formato, o para no
  // rompernos con datos ya normalizados) — se toma tal cual.
  const isoMatch = value.match(ISO_RE);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // Formato confirmado por el usuario: DD/MM/YYYY[ HH:mm[:ss]].
  const ddmmyyyyMatch = value.match(DDMMYYYY_RE);
  if (ddmmyyyyMatch) {
    const [, dd, mm, yyyy] = ddmmyyyyMatch;
    const day = Number(dd);
    const month = Number(mm);
    // Validación mínima de rango — un valor fuera de rango no se adivina,
    // se trata como no parseable (ver comentario del módulo).
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return '';
}

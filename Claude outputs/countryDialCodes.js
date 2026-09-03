// Éter — mapeo de indicativo telefónico por país, usado exclusivamente
// para limpiar la columna `To` del CSV de Workingbits (quitar el
// indicativo antes de cruzar contra `silver.customers.phone`, que en el
// Data Warehouse se guarda SIN indicativo — confirmado contra datos
// reales de Metabase en la sesión del pivote de Fase 2.1).
//
// Las claves son las mismas `value` que ya usa
// src/agents/minerva/constants/countries.js / countries_config, para que
// Hefesto pueda pasar directamente el país elegido en el <select> del
// formulario de /upload.
export const COUNTRY_DIAL_CODES = {
  colombia: '57',
  chile: '56',
  mexico: '52',
  argentina: '54',
  'brasil-nl': '55',
  'brasil-lv': '55',
  // Fase 2.4 ("CORRECCIÓN FASE 2.4 — DEBUGGING DE UI Y PARSEO DE DATOS"):
  // 'brasil' es el hint GENÉRICO que usa parseWorkingbitsCsv.js mientras
  // todavía no sabe si un grupo/campaña puntual es NL o LV (eso se
  // resuelve POR GRUPO, ver ese archivo) — el indicativo telefónico es
  // el mismo (55) sin importar la tienda, así que no hace falta esperar
  // a esa resolución para limpiar los teléfonos.
  brasil: '55',
};

/** Devuelve el indicativo para un `value` de país, o null si no se conoce. */
export function dialCodeFor(countryValue) {
  return COUNTRY_DIAL_CODES[countryValue] ?? null;
}

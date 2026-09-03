import { COUNTRIES } from '../../minerva/constants/countries.js';

// Éter — detección automática de país/tienda desde el propio CSV de
// Workingbits (Fase 2.3, "REFINAMIENTO FASE 2.3 — OPTIMIZACIÓN DE QUERYS
// Y AUTOMATIZACIÓN DE CSV"). Antes de esa sesión, /upload obligaba a
// elegir el país a mano en un <select> ANTES de leer el archivo — el
// usuario pidió eliminar ese paso manual: Éter ahora lee la columna
// `Country Name` de la primera fila del CSV y resuelve el `value` del
// país (mismo catálogo que src/agents/minerva/constants/countries.js)
// sin intervención humana, salvo el caso de Brasil descrito abajo.
//
// FIX (sesión "CORRECCIÓN FASE 2.4 — DEBUGGING DE UI Y PARSEO DE DATOS"):
// la primera versión de esta función, al ver `Country Name` = "Brasil"/
// "Brazil", intentaba resolver NL vs LV mirando el `Communication Name`
// de la PRIMERA FILA DEL ARCHIVO y aplicaba ese resultado a TODO el
// archivo por igual. El usuario detectó, revisando la base de datos
// real, que esto asignaba mal el país: un CSV puede traer FILAS de más
// de una campaña/comunicación distinta (`Communication Name` distinto
// por grupo — ver parseWorkingbitsCsv.js, que agrupa por ese campo), y
// si la primera fila del archivo resultaba ser `LV_...`, TODAS las
// campañas del archivo se guardaban como `brasil-lv`, incluidas las que
// claramente empezaban con `NL_`.
//
// Corrección: esta función YA NO intenta resolver NL/LV. Para Brasil
// solo confirma que el `Country Name` es Brasil y devuelve el hint
// genérico `'brasil'` — la resolución NL vs LV se mueve a
// `parseWorkingbitsCsv.js`, que la hace POR CADA GRUPO/campaña usando su
// propio `Communication Name`, nunca el de otro grupo del mismo archivo.
//
// Extensión razonable no pedida explícitamente por el usuario, agregada a
// propósito por consistencia defensiva: cualquier `Country Name` que no
// coincida con ninguno de los 6 países conocidos también dispara
// `needsManualSelection: true` (en vez de fallar silenciosamente o
// asignar un país incorrecto) — el modal de confirmación, en ese caso,
// ofrece el catálogo completo de países en vez de solo Brasil NL/LV.
//
// Riesgo documentado (mismo espíritu que "Pendiente de definir" en
// eter.md): el formato EXACTO de la columna `Country Name` del CSV real
// de Workingbits no se pudo verificar contra un archivo de ejemplo en
// esta sesión — la normalización (minúsculas, sin acentos, sin espacios
// extra) cubre las variantes más probables ("Colombia", "México"/"Mexico",
// "Brasil"/"Brazil"), pero un valor inesperado (ej. un código de país en
// vez del nombre) cae al mismo camino seguro: pedir confirmación manual
// en vez de asignar un país incorrecto sin que nadie lo note.

/** Minúsculas, sin acentos, sin espacios de sobra — para comparar nombres de país de forma tolerante. */
function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Nombres de país del CSV -> `value` del catálogo (countries.js). Países
// SIN caso especial: se asignan directo, sin inspeccionar nada más.
const DIRECT_COUNTRY_NAME_TO_VALUE = {
  colombia: 'colombia',
  chile: 'chile',
  mexico: 'mexico',
  argentina: 'argentina',
};

const BRAZIL_COUNTRY_NAMES = new Set(['brasil', 'brazil']);

/** Hint genérico que devuelve esta función para Brasil — parseWorkingbitsCsv.js resuelve NL/LV por grupo. */
export const BRAZIL_HINT = 'brasil';

/** Primera fila cuyo valor en `column` no esté vacío tras recortar espacios. */
function firstNonEmpty(rows, column) {
  for (const row of rows) {
    const value = String(row?.[column] ?? '').trim();
    if (value) return value;
  }
  return '';
}

/**
 * Detecta el país (o, para Brasil, el hint genérico que Éter resuelve
 * después por grupo) de un CSV de Workingbits ya parseado por PapaParse
 * (header: true).
 *
 * @param {Array<Record<string, string>>} rows
 * @returns {{
 *   countryValue: string | null,
 *   needsManualSelection: boolean,
 *   reason?: 'no-country-column' | 'unknown-country-name',
 *   rawCountryName: string,
 * }}
 */
export function detectCountryFromCsv(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const rawCountryName = firstNonEmpty(list, 'Country Name');
  const normalizedCountryName = normalize(rawCountryName);

  if (!normalizedCountryName) {
    return { countryValue: null, needsManualSelection: true, reason: 'no-country-column', rawCountryName: '' };
  }

  const directValue = DIRECT_COUNTRY_NAME_TO_VALUE[normalizedCountryName];
  if (directValue) {
    return { countryValue: directValue, needsManualSelection: false, rawCountryName };
  }

  if (BRAZIL_COUNTRY_NAMES.has(normalizedCountryName)) {
    // NO se resuelve NL/LV acá — ver "FIX" arriba. parseWorkingbitsCsv.js
    // hace esa resolución por cada grupo con su propio Communication Name.
    return { countryValue: BRAZIL_HINT, needsManualSelection: false, rawCountryName };
  }

  return { countryValue: null, needsManualSelection: true, reason: 'unknown-country-name', rawCountryName };
}

/** Catálogo completo, para poblar el modal de confirmación manual cuando `needsManualSelection` es true. */
export function manualSelectionOptions() {
  return COUNTRIES;
}

import { COUNTRIES } from '../../minerva/constants/countries.js';

// Éter — detección automática de país/tienda desde el propio CSV de
// Workingbits (Fase 2.3, "REFINAMIENTO FASE 2.3 — OPTIMIZACIÓN DE QUERYS
// Y AUTOMATIZACIÓN DE CSV"). Antes de esta sesión, /upload obligaba a
// elegir el país a mano en un <select> ANTES de leer el archivo — el
// usuario pidió eliminar ese paso manual: Éter ahora lee la columna
// `Country Name` de la primera fila del CSV y resuelve el `value` del
// país (mismo catálogo que src/agents/minerva/constants/countries.js)
// sin intervención humana, salvo el caso ambiguo de Brasil descrito abajo.
//
// Caso especial de negocio: Brasil tiene DOS tiendas distintas en el
// mismo país ("Brasil NL" / business_unit BR, y "Brasil LV" / business_unit
// LV — ver countries.js). El `Country Name` del CSV solo dice "Brasil"/
// "Brazil" para ambas, así que no alcanza por sí solo: hay que inspeccionar
// el prefijo de `Communication Name` (`NL_...` o `LV_...`, dado por el
// usuario) para decidir cuál. Si el prefijo no es reconocible, Éter NO
// adivina: devuelve `needsManualSelection: true` para que Hefesto muestre
// un modal pidiendo confirmación (ver CsvUploadForm.jsx).
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
    .replace(/[̀-ͯ]/g, ''); // quita marcas diacríticas combinadas (acentos) tras NFD
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

/** Primera fila cuyo valor en `column` no esté vacío tras recortar espacios. */
function firstNonEmpty(rows, column) {
  for (const row of rows) {
    const value = String(row?.[column] ?? '').trim();
    if (value) return value;
  }
  return '';
}

/**
 * Detecta el país/tienda de un CSV de Workingbits ya parseado por
 * PapaParse (header: true).
 *
 * @param {Array<Record<string, string>>} rows
 * @returns {{
 *   countryValue: string | null,
 *   needsManualSelection: boolean,
 *   reason?: 'no-country-column' | 'unknown-country-name' | 'brazil-ambiguous',
 *   rawCountryName: string,
 *   communicationName?: string,
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
    const communicationName = firstNonEmpty(list, 'Communication Name');
    if (/^NL_/i.test(communicationName)) {
      return { countryValue: 'brasil-nl', needsManualSelection: false, rawCountryName, communicationName };
    }
    if (/^LV_/i.test(communicationName)) {
      return { countryValue: 'brasil-lv', needsManualSelection: false, rawCountryName, communicationName };
    }
    return { countryValue: null, needsManualSelection: true, reason: 'brazil-ambiguous', rawCountryName, communicationName };
  }

  return { countryValue: null, needsManualSelection: true, reason: 'unknown-country-name', rawCountryName };
}

/** Catálogo completo, para poblar el modal de confirmación manual cuando `needsManualSelection` es true. */
export function manualSelectionOptions() {
  return COUNTRIES;
}

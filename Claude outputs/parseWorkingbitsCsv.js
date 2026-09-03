import { cleanPhoneNumber, } from './cleanPhoneNumber.js';
import { dialCodeFor } from './countryDialCodes.js';
import { parseWorkingbitsDate } from './parseWorkingbitsDate.js';
import { BRAZIL_HINT } from './detectCountryFromCsv.js';

// Éter — agrupador/transformador del CSV de Workingbits (pivote de Fase
// 2.1, sesión "PIVOTE FASE 2.1 — Ingesta de CSV y Automatización de
// Calculadora"). Función pura: recibe filas YA parseadas por PapaParse
// (Hefesto hace la lectura del archivo en /upload) y el país/hint
// resuelto por `detectCountryFromCsv.js`, y devuelve el array de
// campañas agrupadas listo para que Deméter lo persista en
// `sms_processed_campaigns`.
//
// Columnas esperadas por fila (nombres exactos del CSV de Workingbits,
// dados por el usuario):
//   `Communication Name`, `Send At`, `Text`, `To`, `Status`,
//   `Communication Start Date` (Fase 2.3), `Country Name` (Fase 2.3, leída
//   por detectCountryFromCsv.js — Éter no la vuelve a leer acá).
//
// Reglas estrictas (instrucción explícita del usuario):
//   - `fecha`: se toma del PRIMER `Send At` que aparece para esa campaña
//     en el archivo (no el más reciente/antiguo — el primero en orden de
//     aparición del CSV), normalizado a `YYYY-MM-DD` (Fase 2.4, ver
//     "FIX FECHA" abajo).
//   - `fechaComunicacion` (Fase 2.3): se toma del PRIMER `Communication
//     Start Date` del grupo, mismo criterio que `fecha`, también
//     normalizado a `YYYY-MM-DD`. Es un campo DISTINTO de `fecha`/`Send
//     At` (que puede variar fila a fila si el envío se hizo en tandas) —
//     `Communication Start Date` es la fecha real de inicio de la
//     comunicación, y es la que la Calculadora usa para autocompletar
//     (y bloquear) "Fecha de envío".
//   - `mensaje`: se toma del PRIMER `Text` de esa campaña, mismo criterio.
//   - `muestra_entregados`: conteo ESTRICTO de filas con
//     `Status === 'Delivered'` (comparación exacta, sin normalizar
//     mayúsculas/espacios — así viene documentado el valor exacto del
//     CSV). Cualquier otro estado (`Rejected`, etc.) queda fuera del
//     conteo Y fuera de `telefonos_validos`.
//   - `telefonos_validos`: array de los `To` de esas mismas filas
//     `Delivered`, limpios de indicativo de país (ver cleanPhoneNumber.js).
//     Se descartan valores de `To` vacíos tras la limpieza.
//   - `countryValue` (por grupo, Fase 2.4 — ver "FIX BRASIL" abajo): el
//     país/tienda resuelto para ESE grupo puntual. Para países sin caso
//     especial es siempre `countryHint`. Para Brasil (`countryHint ===
//     'brasil'`) se resuelve por el propio `Communication Name` del
//     grupo — nunca heredado de otro grupo del mismo archivo.
//
// FIX FECHA (sesión "CORRECCIÓN FASE 2.4"): antes se guardaba el valor
// CRUDO de `Send At`/`Communication Start Date` y se dejaba que
// `parseCsvDate.js` (Minerva) lo interpretara recién al mostrarlo en la
// Calculadora. El usuario confirmó que el CSV real trae
// `DD/MM/YYYY HH:mm:ss`, formato que `new Date()` en JavaScript
// interpreta como MM/DD/YYYY (orden estadounidense) — para días > 12
// daba una fecha inválida (campo vacío) y para días ≤ 12 daba una fecha
// SILENCIOSAMENTE INCORRECTA. Ahora se normaliza a `YYYY-MM-DD` ACÁ, con
// `parseWorkingbitsDate.js` (que asume explícitamente DD/MM/YYYY, el
// formato real confirmado), antes de guardar nada.
//
// FIX BRASIL (sesión "CORRECCIÓN FASE 2.4"): la versión anterior
// resolvía NL vs LV una sola vez para TODO el archivo (mirando la
// primera fila), lo que asignaba mal el país a campañas mezcladas en un
// mismo CSV. Ahora `resolveBrazilStore()` se llama POR GRUPO, con el
// `Communication Name` de ESE grupo — un archivo con campañas `NL_...` y
// `LV_...` mezcladas ahora las separa correctamente.
//
// @param {Array<Record<string,string>>} rows Filas ya parseadas por PapaParse (header:true).
// @param {string} countryHint `value` de país resuelto por detectCountryFromCsv.js, o el hint
//   genérico `'brasil'` (`BRAZIL_HINT`) cuando falta resolver NL/LV.
// @returns {Array<{
//   campaignName: string,
//   countryValue: string | null,
//   fecha: string,
//   fechaComunicacion: string,
//   mensaje: string,
//   muestraEntregados: number,
//   telefonosValidos: string[],
//   totalRows: number,
// }>}
const DELIVERED_STATUS = 'Delivered';

/**
 * Resuelve la tienda de Brasil ('brasil-nl' / 'brasil-lv') a partir del
 * `Communication Name` de UN grupo puntual — nunca del de otro grupo.
 * Devuelve `null` si el nombre no tiene ninguno de los dos prefijos (caso
 * ambiguo: CsvUploadForm.jsx debe pedir confirmación manual para ese
 * grupo específico, ver el modal post-parseo).
 */
function resolveBrazilStore(campaignName) {
  const upper = String(campaignName ?? '').toUpperCase();
  if (upper.startsWith('NL_') || upper.includes('NL_')) return 'brasil-nl';
  if (upper.startsWith('LV_') || upper.includes('LV_')) return 'brasil-lv';
  return null;
}

export function parseWorkingbitsCsv(rows, countryHint) {
  const isBrazilHint = countryHint === BRAZIL_HINT;
  const dialCode = dialCodeFor(countryHint);
  const groups = new Map(); // Communication Name -> acumulador

  for (const row of Array.isArray(rows) ? rows : []) {
    const campaignName = (row['Communication Name'] ?? '').trim();
    if (!campaignName) continue; // fila sin nombre de campaña: no se puede agrupar, se descarta

    if (!groups.has(campaignName)) {
      groups.set(campaignName, {
        campaignName,
        countryValue: isBrazilHint ? resolveBrazilStore(campaignName) : countryHint,
        fecha: parseWorkingbitsDate(row['Send At']) || (row['Send At'] ?? '').trim(),
        fechaComunicacion:
          parseWorkingbitsDate(row['Communication Start Date']) || (row['Communication Start Date'] ?? '').trim(),
        mensaje: (row['Text'] ?? '').trim(),
        muestraEntregados: 0,
        telefonosValidos: [],
        totalRows: 0,
      });
    }

    const group = groups.get(campaignName);
    group.totalRows += 1;

    const status = (row['Status'] ?? '').trim();
    if (status === DELIVERED_STATUS) {
      group.muestraEntregados += 1;
      const cleaned = cleanPhoneNumber(row['To'], dialCode);
      if (cleaned) group.telefonosValidos.push(cleaned);
    }
  }

  return Array.from(groups.values());
}

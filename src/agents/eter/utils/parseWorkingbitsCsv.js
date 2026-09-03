import { cleanPhoneNumber, } from './cleanPhoneNumber.js';
import { dialCodeFor } from './countryDialCodes.js';

// Éter — agrupador/transformador del CSV de Workingbits (pivote de Fase
// 2.1, sesión "PIVOTE FASE 2.1 — Ingesta de CSV y Automatización de
// Calculadora"). Función pura: recibe filas YA parseadas por PapaParse
// (Hefesto hace la lectura del archivo en /upload) y el `value` del país
// elegido, y devuelve el array de campañas agrupadas listo para que
// Deméter lo persista en `sms_processed_campaigns`.
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
//     aparición del CSV).
//   - `fechaComunicacion` (Fase 2.3, "REFINAMIENTO FASE 2.3 —
//     AUTOMATIZACIÓN DE CSV"): se toma del PRIMER `Communication Start
//     Date` del grupo, mismo criterio que `fecha`. Es un campo DISTINTO
//     de `fecha`/`Send At` (que puede variar fila a fila si el envío se
//     hizo en tandas) — `Communication Start Date` es la fecha real de
//     inicio de la comunicación, y desde esta sesión es la que la
//     Calculadora usa para autocompletar (y bloquear) "Fecha de envío",
//     por consistencia con la consulta a Metabase. Se guarda igual de
//     "cruda" que `fecha` (texto tal como viene del CSV) — el parseo a
//     `YYYY-MM-DD` lo hace `parseCsvDate` en la Calculadora, no acá.
//   - `mensaje`: se toma del PRIMER `Text` de esa campaña, mismo criterio.
//   - `muestra_entregados`: conteo ESTRICTO de filas con
//     `Status === 'Delivered'` (comparación exacta, sin normalizar
//     mayúsculas/espacios — así viene documentado el valor exacto del
//     CSV). Cualquier otro estado (`Rejected`, etc.) queda fuera del
//     conteo Y fuera de `telefonos_validos`.
//   - `telefonos_validos`: array de los `To` de esas mismas filas
//     `Delivered`, limpios de indicativo de país (ver cleanPhoneNumber.js).
//     Se descartan valores de `To` vacíos tras la limpieza.
//
// @param {Array<Record<string,string>>} rows Filas ya parseadas por PapaParse (header:true).
// @param {string} countryValue `value` del país (Fase 2.3: ya NO lo elige el usuario a mano en
//   /upload — lo resuelve detectCountryFromCsv.js antes de llamar a esta función).
// @returns {Array<{
//   campaignName: string,
//   fecha: string,
//   fechaComunicacion: string,
//   mensaje: string,
//   muestraEntregados: number,
//   telefonosValidos: string[],
//   totalRows: number,
// }>}
const DELIVERED_STATUS = 'Delivered';

export function parseWorkingbitsCsv(rows, countryValue) {
  const dialCode = dialCodeFor(countryValue);
  const groups = new Map(); // Communication Name -> acumulador

  for (const row of Array.isArray(rows) ? rows : []) {
    const campaignName = (row['Communication Name'] ?? '').trim();
    if (!campaignName) continue; // fila sin nombre de campaña: no se puede agrupar, se descarta

    if (!groups.has(campaignName)) {
      groups.set(campaignName, {
        campaignName,
        fecha: (row['Send At'] ?? '').trim(),
        fechaComunicacion: (row['Communication Start Date'] ?? '').trim(),
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

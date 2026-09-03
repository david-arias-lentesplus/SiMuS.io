// Minerva — cliente del cruce REAL de conversiones del Grupo SMS vía la
// API Route de Hermes (corrección de Fase 2.2, "RESTAURACIÓN DE HUBSPOT Y
// MANEJO DE DUPLICADOS"). Reemplaza fetchConversionsByPhoneFromMetabase.js
// (solo-teléfono, del pivote de Fase 2.1): el Grupo SMS ahora vuelve a
// necesitar HubSpot (para los emails de la lista que el usuario escribe)
// combinados con los teléfonos que Éter ya extrajo del CSV de Workingbits
// para la campaña elegida — Hermes cruza `(email OR phone)` contra
// Metabase en una sola llamada a esta función. Nunca llama a Metabase
// directamente: la única puerta de entrada sigue siendo
// /api/metabase/conversions.js.
//
// @param {string[]} emails Emails de la lista de HubSpot del Grupo SMS
//   (ver fetchSegmentFromHubSpot.js).
// @param {string[]} phones Teléfonos ya limpios de indicativo de país
//   (ver src/agents/eter/utils/cleanPhoneNumber.js), de
//   `sms_processed_campaigns.telefonos_validos`.
// @param {string} businessUnit Código de business_unit del país seleccionado.
// @param {string} sendDate Fecha de envío en formato 'YYYY-MM-DD'.
// @returns {Promise<{conversions: number, totalSales: number}>}
export async function fetchConversionsForSmsGroup({ emails, phones, businessUnit, sendDate }) {
  const res = await fetch('/api/metabase/conversions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emails: (emails ?? []).filter((e) => typeof e === 'string' && e.trim()),
      phones: (phones ?? []).filter((p) => typeof p === 'string' && p.trim()),
      businessUnit,
      sendDate,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Respuesta no-JSON — mismo caso que fetchConversionsFromMetabase.js.
  }

  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status} al consultar conversiones en Metabase.`);
  }

  return {
    conversions: Number(data?.conversions) || 0,
    totalSales: Number(data?.totalSales) || 0,
  };
}

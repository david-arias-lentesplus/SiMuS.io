// Minerva — cliente del cruce REAL de conversiones POR TELÉFONO vía la
// API Route de Hermes (pivote de Fase 2.1). Hermano de
// fetchConversionsFromMetabase.js (que sigue usándose para el Grupo
// Control, por email); este archivo es el que consume el Grupo SMS desde
// que dejó de buscar un segmento de HubSpot y pasó a usar
// `telefonos_validos` de la campaña procesada por Éter (ver
// useCampaignCalculator.js). Nunca llama a Metabase directamente: la
// única puerta de entrada sigue siendo /api/metabase/conversions.js.
//
// @param {string[]} phones Teléfonos ya limpios de indicativo de país
//   (ver src/agents/eter/utils/cleanPhoneNumber.js), tal como los guardó
//   Éter en `sms_processed_campaigns.telefonos_validos`.
// @param {string} businessUnit Código de business_unit del país seleccionado.
// @param {string} sendDate Fecha de envío en formato 'YYYY-MM-DD'.
// @returns {Promise<{conversions: number, totalSales: number}>}
export async function fetchConversionsByPhoneFromMetabase({ phones, businessUnit, sendDate }) {
  const res = await fetch('/api/metabase/conversions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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

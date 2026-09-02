// Minerva — cliente del cruce REAL de conversiones vía la API Route de
// Hermes (sesión 2026-09-02, "AJUSTE DE INTEGRACIÓN METABASE"). Reemplaza
// simulateConversions.js (eliminado en esta misma sesión). Nunca llama a
// Metabase directamente: la única puerta de entrada es
// /api/metabase/conversions.js.
//
// @param {string[]} emails Correos del segmento (ya traídos de HubSpot vía
//   fetchSegmentFromHubSpot — se filtran del lado del servidor, pero se
//   filtran también acá por baratos que sean los descartes obvios).
// @param {string} businessUnit Código de business_unit del país seleccionado
//   (ver COUNTRIES en src/agents/minerva/constants/countries.js).
// @param {string} sendDate Fecha de envío en formato 'YYYY-MM-DD'.
// @returns {Promise<{conversions: number, totalSales: number}>}
export async function fetchConversionsFromMetabase({ emails, businessUnit, sendDate }) {
  const res = await fetch('/api/metabase/conversions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emails: (emails ?? []).filter((e) => typeof e === 'string' && e.trim()),
      businessUnit,
      sendDate,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Respuesta no-JSON — mismo caso que fetchSegmentFromHubSpot.js.
  }

  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status} al consultar conversiones en Metabase.`);
  }

  return {
    conversions: Number(data?.conversions) || 0,
    totalSales: Number(data?.totalSales) || 0,
  };
}

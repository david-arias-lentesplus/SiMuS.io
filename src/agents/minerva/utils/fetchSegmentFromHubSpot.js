// Minerva — cliente del segmento REAL vía la API Route de Hermes
// (Fase 2, sesión 2026-09-02). Reemplaza la simulación de tamaño de
// muestra de la Fase 1. Nunca llama a HubSpot directamente ni importa
// src/agents/hermes/services/hubspotService.js: la única puerta de
// entrada es /api/hubspot/segment.js (regla de arquitectura de
// .claude/agents/hermes.md — "ningún otro agente llama a la API de
// HubSpot directamente").
//
// Lo que SIGUE simulado (Fase 2 no lo resuelve): el cruce de conversiones
// (compras en los 7 días posteriores al envío) depende de Metabase/
// Workingbits, que Iris todavía no integra — ver simulateConversions.js.
export async function fetchSegmentFromHubSpot(listName) {
  const res = await fetch('/api/hubspot/segment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Respuesta no-JSON (ej. error 500 crudo del runtime de Vercel, o la
    // ruta /api no existe porque se está corriendo `vite dev` en vez de
    // `vercel dev` — ver nota en HANDOFF.md, sesión 2026-09-02).
  }

  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status} al consultar el segmento en HubSpot.`);
  }

  return {
    sampleSize: Number(data?.sampleSize) || 0,
    contacts: Array.isArray(data?.contacts) ? data.contacts : [],
  };
}

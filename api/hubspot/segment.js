import { fetchSegmentSummary, HubSpotApiError } from '../../src/agents/hermes/services/hubspotService.js';

// Hermes — API Route de Vercel (Fase 2, sesión 2026-09-02).
// Única puerta de entrada del cliente a HubSpot: protege HS_PAT (nunca se
// expone al navegador) y evita el bloqueo de CORS que HubSpot impone a
// llamadas directas desde el cliente. Vive en /api (raíz del repo) porque
// así lo exige Vercel para detectar Serverless Functions en un proyecto
// Vite — la lógica de negocio real vive en
// src/agents/hermes/services/hubspotService.js (carpeta de Hermes), este
// archivo es solo el punto de entrada HTTP.
//
// Minerva (src/agents/minerva/utils/fetchSegmentFromHubSpot.js) llama a
// esta ruta con POST { listName } y recibe { sampleSize, contacts }.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido, usa POST.' });
  }

  const { listName } = req.body ?? {};
  if (!listName || typeof listName !== 'string' || !listName.trim()) {
    return res.status(400).json({ error: '"listName" es requerido.' });
  }

  try {
    const summary = await fetchSegmentSummary(listName.trim());
    return res.status(200).json(summary);
  } catch (err) {
    const status = err instanceof HubSpotApiError && Number.isInteger(err.status) ? err.status : 502;
    console.error('[Hermes] Error consultando HubSpot:', err);
    return res.status(status).json({ error: err.message || 'Error al consultar HubSpot.' });
  }
}

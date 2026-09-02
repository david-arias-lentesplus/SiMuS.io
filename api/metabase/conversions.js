import { fetchConversionsFromWarehouse, MetabaseApiError } from '../../src/agents/hermes/services/metabaseService.js';

// Hermes — API Route de Vercel (sesión 2026-09-02, "AJUSTE DE INTEGRACIÓN
// METABASE"). Igual que api/hubspot/segment.js: vive en /api (raíz del
// repo) porque así lo exige Vercel para detectar Serverless Functions en
// un proyecto Vite; la lógica real vive en
// src/agents/hermes/services/metabaseService.js.
//
// Minerva (src/agents/minerva/utils/fetchConversionsFromMetabase.js) llama
// a esta ruta con POST { emails, businessUnit, sendDate } y recibe
// { conversions, totalSales }.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido, usa POST.' });
  }

  const { emails, businessUnit, sendDate } = req.body ?? {};
  if (!Array.isArray(emails)) {
    return res.status(400).json({ error: '"emails" debe ser un array.' });
  }
  if (!businessUnit || typeof businessUnit !== 'string') {
    return res.status(400).json({ error: '"businessUnit" es requerido.' });
  }
  if (!sendDate || typeof sendDate !== 'string') {
    return res.status(400).json({ error: '"sendDate" es requerido (formato YYYY-MM-DD).' });
  }

  try {
    const result = await fetchConversionsFromWarehouse({ emails, businessUnit, sendDate });
    return res.status(200).json(result);
  } catch (err) {
    const status = err instanceof MetabaseApiError && Number.isInteger(err.status) ? err.status : 502;
    console.error('[Hermes] Error consultando Metabase:', err);
    return res.status(status).json({ error: err.message || 'Error al consultar Metabase.' });
  }
}

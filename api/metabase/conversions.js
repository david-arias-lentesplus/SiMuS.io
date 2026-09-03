import {
  fetchConversionsFromWarehouse,
  fetchConversionsFromWarehouseCombined,
  MetabaseApiError,
} from '../../src/agents/hermes/services/metabaseService.js';

// Hermes — API Route de Vercel. Vive en /api (raíz del repo) porque así
// lo exige Vercel para detectar Serverless Functions en un proyecto Vite;
// la lógica real vive en src/agents/hermes/services/metabaseService.js.
//
// Corrección de Fase 2.2 ("RESTAURACIÓN DE HUBSPOT Y MANEJO DE
// DUPLICADOS"): esta ruta acepta dos formas de payload, distinguidas por
// la presencia de "phones":
//   - { emails, businessUnit, sendDate }          -> Grupo Control: cruce
//     directo por email contra silver.sales (sin cambios desde ADR 0006).
//   - { emails, phones, businessUnit, sendDate }  -> Grupo SMS: cruce
//     combinado (email O teléfono) vía silver.customers -> silver.sales
//     (ver fetchConversionsFromWarehouseCombined). "emails" puede venir
//     vacío en este modo si el usuario no encontró una lista de HubSpot,
//     pero "phones" es lo que dispara este modo — así el Grupo SMS sigue
//     funcionando aunque HubSpot no devuelva nada.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido, usa POST.' });
  }

  const { emails, phones, businessUnit, sendDate } = req.body ?? {};
  const hasPhones = Array.isArray(phones);
  const hasEmails = Array.isArray(emails);

  if (!hasPhones && !hasEmails) {
    return res.status(400).json({
      error: 'Debes enviar "emails" (Grupo Control) o "emails" + "phones" (Grupo SMS), como arrays.',
    });
  }
  if (!businessUnit || typeof businessUnit !== 'string') {
    return res.status(400).json({ error: '"businessUnit" es requerido.' });
  }
  if (!sendDate || typeof sendDate !== 'string') {
    return res.status(400).json({ error: '"sendDate" es requerido (formato YYYY-MM-DD).' });
  }

  try {
    const result = hasPhones
      ? await fetchConversionsFromWarehouseCombined({ emails: hasEmails ? emails : [], phones, businessUnit, sendDate })
      : await fetchConversionsFromWarehouse({ emails, businessUnit, sendDate });
    return res.status(200).json(result);
  } catch (err) {
    const status = err instanceof MetabaseApiError && Number.isInteger(err.status) ? err.status : 502;
    console.error('[Hermes] Error consultando Metabase:', err);
    return res.status(status).json({ error: err.message || 'Error al consultar Metabase.' });
  }
}

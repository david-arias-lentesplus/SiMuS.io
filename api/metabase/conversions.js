import {
  fetchConversionsFromWarehouse,
  fetchConversionsFromWarehouseByPhone,
  MetabaseApiError,
} from '../../src/agents/hermes/services/metabaseService.js';

// Hermes — API Route de Vercel. Vive en /api (raíz del repo) porque así
// lo exige Vercel para detectar Serverless Functions en un proyecto Vite;
// la lógica real vive en src/agents/hermes/services/metabaseService.js.
//
// Pivote de Fase 2.1: esta ruta ahora acepta DOS formas de payload,
// mutuamente excluyentes:
//   - { emails, businessUnit, sendDate }  -> cruce por email (Grupo Control,
//     sigue viniendo de src/agents/minerva/utils/fetchConversionsFromMetabase.js).
//   - { phones, businessUnit, sendDate }  -> cruce por teléfono (Grupo SMS,
//     viene de src/agents/minerva/utils/fetchConversionsByPhoneFromMetabase.js,
//     con los `telefonos_validos` que Éter extrajo del CSV de Workingbits).
// Nunca se aceptan ambas a la vez ni ninguna de las dos — se responde 400
// para dejar el contrato explícito en vez de adivinar cuál usar.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido, usa POST.' });
  }

  const { emails, phones, businessUnit, sendDate } = req.body ?? {};
  const hasEmails = Array.isArray(emails);
  const hasPhones = Array.isArray(phones);

  if (hasEmails === hasPhones) {
    return res.status(400).json({
      error: 'Debes enviar exactamente uno de los dos: "emails" (array) o "phones" (array), nunca ambos ni ninguno.',
    });
  }
  if (!businessUnit || typeof businessUnit !== 'string') {
    return res.status(400).json({ error: '"businessUnit" es requerido.' });
  }
  if (!sendDate || typeof sendDate !== 'string') {
    return res.status(400).json({ error: '"sendDate" es requerido (formato YYYY-MM-DD).' });
  }

  try {
    const result = hasEmails
      ? await fetchConversionsFromWarehouse({ emails, businessUnit, sendDate })
      : await fetchConversionsFromWarehouseByPhone({ phones, businessUnit, sendDate });
    return res.status(200).json(result);
  } catch (err) {
    const status = err instanceof MetabaseApiError && Number.isInteger(err.status) ? err.status : 502;
    console.error('[Hermes] Error consultando Metabase:', err);
    return res.status(status).json({ error: err.message || 'Error al consultar Metabase.' });
  }
}

// Hermes — SOLO SERVIDOR. Este módulo usa `process.env` y llama a la API
// de HubSpot autenticado con el Private App Token (HS_PAT). NUNCA debe
// importarse desde código que corra en el navegador (ningún componente/
// hook de Hefesto o Minerva) — la única puerta de entrada es la API Route
// de Vercel en /api/hubspot/segment.js, que corre en el servidor y
// protege el token y evita el bloqueo de CORS del cliente contra HubSpot.
//
// Fase 2 (sesión 2026-09-02): integración real de segmentos, activada por
// instrucción explícita del usuario. Reemplaza la simulación de tamaño de
// muestra de la Fase 1 — ver src/agents/minerva/utils/fetchSegmentFromHubSpot.js
// (consumidor real) y simulateConversions.js (lo que sigue simulado).
//
// Documentación oficial: https://developers.hubspot.com/docs/api-reference/legacy/overview

const HUBSPOT_BASE = 'https://api.hubapi.com';
const CONTACTS_OBJECT_TYPE_ID = '0-1';
const BATCH_SIZE = 100;
const MAX_RETRIES = 4;

export class HubSpotApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'HubSpotApiError';
    this.status = status;
  }
}

function authHeaders() {
  const token = process.env.HS_PAT;
  if (!token) {
    throw new HubSpotApiError('HS_PAT no está configurado en el entorno del servidor.', 500);
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch con reintentos exponenciales ante 429 (rate limit) y 5xx
 * transitorios de HubSpot, respetando el header Retry-After cuando viene.
 * Regla de Hermes (.claude/agents/hermes.md): "manejar rate limits y
 * reintentos sin duplicar llamadas ni datos".
 */
async function hubspotFetch(path, options = {}, attempt = 0) {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });

  if (res.ok) return res.json();

  const retryable = res.status === 429 || res.status >= 500;
  if (retryable && attempt < MAX_RETRIES) {
    const retryAfterHeader = Number(res.headers.get('retry-after'));
    const backoffMs =
      Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : 300 * 2 ** attempt;
    await sleep(backoffMs);
    return hubspotFetch(path, options, attempt + 1);
  }

  const body = await res.text().catch(() => '');
  throw new HubSpotApiError(
    `HubSpot respondió ${res.status} en ${path}${body ? `: ${body.slice(0, 300)}` : ''}`,
    res.status
  );
}

/** Paso 1: resuelve el listId a partir del nombre exacto de la lista. */
async function getListIdByName(listName) {
  const data = await hubspotFetch(
    `/crm/v3/lists/object-type-id/${CONTACTS_OBJECT_TYPE_ID}/name/${encodeURIComponent(listName)}`
  );
  const listId = data?.list?.listId ?? data?.listId;
  if (!listId) {
    throw new HubSpotApiError(`No se encontró ninguna lista de HubSpot llamada "${listName}".`, 404);
  }
  return String(listId);
}

/**
 * Paso 2: pagina /memberships hasta reunir todos los recordId (contact
 * IDs) de la lista, siguiendo paging.next.after mientras exista.
 */
async function getAllListMemberIds(listId) {
  const ids = [];
  let after;
  do {
    const query = new URLSearchParams({ limit: '100' });
    if (after) query.set('after', after);
    const data = await hubspotFetch(`/crm/v3/lists/${listId}/memberships?${query.toString()}`);
    for (const row of data?.results ?? []) {
      if (row?.recordId) ids.push(String(row.recordId));
    }
    after = data?.paging?.next?.after;
  } while (after);
  return ids;
}

/**
 * Paso 3: enriquece los contactos en lotes de 100 vía batch/read.
 * PROHIBIDO (instrucción explícita del usuario): un GET por contacto.
 */
async function batchReadContacts(contactIds, properties) {
  const contacts = [];
  for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
    const chunk = contactIds.slice(i, i + BATCH_SIZE);
    const data = await hubspotFetch(`/crm/v3/objects/contacts/batch/read`, {
      method: 'POST',
      body: JSON.stringify({
        properties,
        inputs: chunk.map((id) => ({ id })),
      }),
    });
    for (const row of data?.results ?? []) {
      contacts.push({
        id: row.id,
        email: row.properties?.email ?? null,
        phone: row.properties?.phone ?? null,
      });
    }
  }
  return contacts;
}

/**
 * Orquesta el flujo completo: nombre de lista -> listId -> IDs paginados
 * -> contactos enriquecidos en lotes. Es lo único que
 * /api/hubspot/segment.js debe llamar; ningún otro módulo del proyecto
 * debe importar este archivo directamente.
 */
export async function fetchSegmentSummary(listName) {
  const listId = await getListIdByName(listName);
  const memberIds = await getAllListMemberIds(listId);
  const contacts = await batchReadContacts(memberIds, ['email', 'phone', 'hs_object_id']);
  return {
    listId,
    sampleSize: memberIds.length,
    contacts,
  };
}

// Hermes — SOLO SERVIDOR. Cruce real de conversiones contra el Data
// Warehouse (Metabase), agregado en la sesión 2026-09-02 por instrucción
// explícita del usuario ("AJUSTE DE INTEGRACIÓN METABASE").
//
// Nota de dominio (para cualquier sesión futura que lea .claude/agents/):
// según las reglas originales del sistema de agentes, Metabase/Workingbits
// es dominio de Iris (ver .claude/agents/iris.md). El usuario, en esta
// sesión, instruyó explícitamente a Hermes para implementar esta consulta
// ("Instrucciones para Hermes (Backend / API Route de Metabase)"), así que
// se implementó aquí, en la carpeta de Hermes, siguiendo esa instrucción
// literal. Iris sigue siendo dueño exclusivo del *envío* de SMS vía
// Workingbits — esto no cambia. Ver ADR 0006 para el detalle completo de
// esta decisión y por qué se documenta como una excepción, no como una
// redefinición permanente de los dominios de agentes.
//
// CORRECCIÓN DE ARQUITECTURA (sesión 2026-09-02, "pruebas de conexión"):
// la primera versión de este archivo asumía la API REST de Metabase
// directamente. El servidor real es un MCP (`metabase-mcp`, el mismo
// conector que este asistente usa en desarrollo como
// `mcp__livo_metabase__*`): JSON-RPC 2.0 sobre HTTP, respuesta en SSE,
// autenticado con `?api_key=...` como query param (headers no funcionan
// contra este servidor). Confirmado con pruebas reales — ver HANDOFF.md.
//
// FIX 413 PAYLOAD TOO LARGE (sesión 2026-09-02): el body-parser del
// servidor MCP rechaza payloads grandes (límite real medido entre
// 92.6KB-106.1KB). Por eso toda lista de emails/teléfonos/IDs que se
// interpola en una consulta se parte en lotes (`BATCH_SIZE` /
// `CUSTOMER_ID_BATCH_SIZE`) y se suman los resultados de cada lote — es
// seguro porque cada partición es disjunta (un mismo valor no puede caer
// en dos lotes a la vez) y las funciones que agregan "ventas" siempre lo
// hacen sobre `distinct sale_id`/`distinct customer_id`.
//
// CORRECCIÓN DE FASE 2.2 (sesión 2026-09-03, "CORRECCIÓN FASE 2.2 —
// RESTAURACIÓN DE HUBSPOT Y MANEJO DE DUPLICADOS"): el pivote de Fase 2.1
// había reemplazado por completo el cruce del Grupo SMS por uno basado
// solo en teléfono (`fetchConversionsFromWarehouseByPhone`, ya no existe
// en este archivo). El usuario corrigió eso: el CSV de Workingbits SOLO
// trae teléfonos, pero el Grupo SMS necesita TAMBIÉN los emails de esa
// misma lista en HubSpot para poder cruzar contra Metabase con el mejor
// match posible (algunos clientes de `silver.customers` pueden tener
// email pero no el teléfono limpio del CSV bien matcheado, o viceversa).
// La función nueva, `fetchConversionsFromWarehouseCombined`, reemplaza a
// la de solo-teléfono: resuelve primero los `customer_id` de
// `silver.customers` cuyo `email` esté en la lista de HubSpot **O** cuyo
// `phone` esté en la lista del CSV (condición `OR`, deduplicados en un
// `Set` en memoria antes de tocar `silver.sales`, para nunca contar dos
// veces al mismo cliente si matchea por las dos vías), y LUEGO agrega
// `silver.sales` por esos `customer_id` ya resueltos. Se hace en dos
// fases (resolver IDs, después agregar ventas) en vez de un único SQL con
// `OR` + `IN` gigante, porque emails y teléfonos deben trocearse en lotes
// distintos para no superar el límite de payload — ver
// `collectMatchedCustomerIds`.
//
// El Grupo Control (`fetchConversionsFromWarehouse`, cruce directo por
// email contra `silver.sales.email`) NO cambia: Hermes sigue yendo a
// HubSpot por esos emails y cruzando contra Metabase igual que en la
// sesión de ajuste de Metabase original (ADR 0006) — ver ADR 0009 para
// por qué no se unificó con el flujo de `silver.customers` del Grupo SMS.
//
// Contrato de negocio (verificado contra el esquema real de
// `silver.sales`/`silver.customers`, confirmado con el conector
// `mcp__livo_metabase__*` antes de escribir este código):
//   1. Ventana de atribución de 7 días: `created_at` entre `sendDate` y
//      `sendDate` + 6 días (7 días en total, contando el día del envío).
//   2. Filtro geográfico: `business_unit` = el código mapeado del país
//      seleccionado en el frontend.
//   3. Exclusión de cancelaciones: cualquier `status` que contenga la
//      palabra "cancel" (case-insensitive) queda afuera.
//   4. `silver.sales` NO tiene columna de teléfono (solo `email`) — el
//      teléfono vive en `silver.customers.phone`, SIN indicativo de país
//      (confirmado con datos reales de `business_unit='CO'`).
//
// Devuelve en ambos flujos: { conversions, totalSales } — conversions =
// conteo de transacciones únicas válidas (`count(distinct sale_id)`),
// totalSales = suma de `gmv_usd` (revenue en USD) de esas transacciones.

export class MetabaseApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'MetabaseApiError';
    this.status = status;
  }
}

const SALES_TABLE = 'silver.sales';
const CUSTOMERS_TABLE = 'silver.customers';
const REVENUE_COLUMN = 'gmv_usd';

// Tamaño máximo de emails/teléfonos por consulta al MCP de Metabase — ver
// nota "FIX 413 PAYLOAD TOO LARGE" arriba.
const BATCH_SIZE = 800;
// customer_id son bigint cortos (ej. "1048576"): un lote mucho más grande
// que BATCH_SIZE sigue muy por debajo del límite de payload medido.
const CUSTOMER_ID_BATCH_SIZE = 3000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Un teléfono ya limpio (ver src/agents/eter/utils/cleanPhoneNumber.js)
// es solo dígitos; se exige un mínimo razonable para descartar basura.
const PHONE_RE = /^\d{6,15}$/;
// Whitelist estricta de business_unit válidos (ver countries.js) — nunca
// se interpola en el SQL un valor que no venga de esta lista.
const VALID_BUSINESS_UNITS = new Set(['CO', 'AR', 'CL', 'MX', 'BR', 'LV']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function metabaseConfig() {
  const mcpUrl = process.env.METABASE_MCP_URL;
  const mcpKey = process.env.METABASE_MCP_KEY;
  const databaseId = process.env.METABASE_DATABASE_ID;
  if (!mcpUrl || !mcpKey || !databaseId) {
    throw new MetabaseApiError(
      'METABASE_MCP_URL, METABASE_MCP_KEY y METABASE_DATABASE_ID deben estar configurados en el entorno del servidor.',
      500
    );
  }
  return { mcpUrl: mcpUrl.replace(/\/+$/, ''), mcpKey, databaseId: Number(databaseId) };
}

/** Escapa un literal de texto para SQL (Postgres): duplica comillas simples. */
function sqlStringLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Valida/normaliza emails: descarta silenciosamente cualquier valor sin forma de email. */
function sanitizeEmails(emails) {
  const seen = new Set();
  for (const raw of Array.isArray(emails) ? emails : []) {
    if (typeof raw !== 'string') continue;
    const email = raw.trim().toLowerCase();
    if (email && EMAIL_RE.test(email)) seen.add(email);
  }
  return Array.from(seen);
}

/** Valida/normaliza teléfonos ya limpios de indicativo (ver cleanPhoneNumber.js). */
function sanitizePhones(phones) {
  const seen = new Set();
  for (const raw of Array.isArray(phones) ? phones : []) {
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    const phone = String(raw).trim();
    if (phone && PHONE_RE.test(phone)) seen.add(phone);
  }
  return Array.from(seen);
}

/** Parte un array en sub-arrays de a lo sumo `size` elementos. */
function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function addDaysISO(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Cláusulas WHERE de ventana de fecha + país + no-cancelado, compartidas por todo cruce sobre silver.sales. */
function sharedSalesWhere({ startDate, endDateExclusive, businessUnitLiteral }) {
  return `
      created_at >= ${startDate}::timestamp
      and created_at < ${endDateExclusive}::timestamp
      and business_unit = ${businessUnitLiteral}
      and status not ilike '%cancel%'
  `;
}

function attributionWindow(sendDate) {
  // Ventana de 7 DÍAS EN TOTAL contando el día del envío (día 0 al día 6),
  // no "sendDate + 7 días" (que darían 8 días) — ver ADR 0006, addendum.
  return {
    startDate: sqlStringLiteral(sendDate),
    endDateExclusive: sqlStringLiteral(addDaysISO(sendDate, 7)),
  };
}

/** Grupo Control: cruce directo por email contra silver.sales (sin cambios desde ADR 0006). */
function buildEmailSalesQuery({ emails, businessUnit, sendDate }) {
  const emailList = emails.map(sqlStringLiteral).join(', ');
  const { startDate, endDateExclusive } = attributionWindow(sendDate);
  const businessUnitLiteral = sqlStringLiteral(businessUnit);

  return `
    select
      count(distinct sale_id) as conversions,
      coalesce(sum(${REVENUE_COLUMN}), 0) as total_sales
    from ${SALES_TABLE}
    where email in (${emailList})
      and ${sharedSalesWhere({ startDate, endDateExclusive, businessUnitLiteral }).trim()}
  `.trim();
}

/** Resuelve customer_id de silver.customers cuyo email esté en el lote dado. */
function buildCustomersByEmailQuery({ emails, businessUnit }) {
  const emailList = emails.map(sqlStringLiteral).join(', ');
  return `
    select distinct customer_id
    from ${CUSTOMERS_TABLE}
    where business_unit = ${sqlStringLiteral(businessUnit)}
      and email in (${emailList})
  `.trim();
}

/** Resuelve customer_id de silver.customers cuyo phone esté en el lote dado. */
function buildCustomersByPhoneQuery({ phones, businessUnit }) {
  const phoneList = phones.map(sqlStringLiteral).join(', ');
  return `
    select distinct customer_id
    from ${CUSTOMERS_TABLE}
    where business_unit = ${sqlStringLiteral(businessUnit)}
      and phone in (${phoneList})
  `.trim();
}

/** Agrega conversions/total_sales de silver.sales para un lote de customer_id ya resueltos. */
function buildSalesByCustomerIdsQuery({ customerIds, businessUnit, sendDate }) {
  const idList = customerIds.join(', '); // bigint: no necesitan sqlStringLiteral
  const { startDate, endDateExclusive } = attributionWindow(sendDate);
  const businessUnitLiteral = sqlStringLiteral(businessUnit);

  return `
    select
      count(distinct sale_id) as conversions,
      coalesce(sum(${REVENUE_COLUMN}), 0) as total_sales
    from ${SALES_TABLE}
    where customer_id in (${idList})
      and ${sharedSalesWhere({ startDate, endDateExclusive, businessUnitLiteral }).trim()}
  `.trim();
}

/**
 * Parsea una respuesta del servidor MCP: el body llega en formato SSE, no
 * como JSON plano. Se toma el último bloque `data:` y se parsea como el
 * JSON-RPC 2.0 de respuesta.
 */
function parseSseJsonRpc(bodyText) {
  const dataLines = bodyText
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  if (dataLines.length === 0) {
    throw new MetabaseApiError('Respuesta del servidor MCP de Metabase sin cuerpo utilizable.', 502);
  }

  try {
    return JSON.parse(dataLines[dataLines.length - 1]);
  } catch {
    throw new MetabaseApiError('No se pudo parsear la respuesta del servidor MCP de Metabase.', 502);
  }
}

/** Llama a una tool del servidor MCP de Metabase (`tools/call`) y devuelve su resultado ya parseado. */
async function callMcpTool(toolName, args, config) {
  const url = `${config.mcpUrl}?api_key=${encodeURIComponent(config.mcpKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // El servidor devuelve 406 si el Accept no incluye AMBOS tipos.
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new MetabaseApiError(
      `Servidor MCP de Metabase respondió ${res.status}${bodyText ? `: ${bodyText.slice(0, 300)}` : ''}`,
      res.status
    );
  }

  const rpc = parseSseJsonRpc(bodyText);
  if (rpc.error) {
    throw new MetabaseApiError(`Error JSON-RPC del servidor MCP: ${rpc.error.message || 'desconocido'}`, 502);
  }

  const content = rpc.result?.content?.[0]?.text;
  if (rpc.result?.isError) {
    throw new MetabaseApiError(`La tool "${toolName}" del MCP de Metabase falló: ${content || 'sin detalle'}`, 502);
  }
  if (typeof content !== 'string') {
    throw new MetabaseApiError(`Respuesta inesperada de la tool "${toolName}" del MCP de Metabase.`, 502);
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new MetabaseApiError(`No se pudo parsear el resultado de la tool "${toolName}".`, 502);
  }
}

/** Ejecuta una query que devuelve UNA fila agregada ({ conversions, total_sales }). */
async function runAggregateQuery(query, config) {
  const result = await callMcpTool('execute', { database_id: config.databaseId, query, row_limit: 5 }, config);
  if (result?.success === false) {
    throw new MetabaseApiError('La consulta a Metabase no se ejecutó correctamente.', 502);
  }
  const row = result?.data?.['0'] ?? result?.data?.[0];
  return {
    conversions: Number(row?.conversions) || 0,
    totalSales: Number(row?.total_sales) || 0,
  };
}

/** Ejecuta una query que devuelve VARIAS filas (ej. una columna customer_id) y las aplana a un array. */
async function runRowsQuery(query, config, rowLimit) {
  const result = await callMcpTool('execute', { database_id: config.databaseId, query, row_limit: rowLimit }, config);
  if (result?.success === false) {
    throw new MetabaseApiError('La consulta a Metabase no se ejecutó correctamente.', 502);
  }
  const dataObj = result?.data ?? {};
  return Object.keys(dataObj)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => dataObj[key]);
}

function assertBusinessUnitAndDate(businessUnit, sendDate) {
  if (!businessUnit || !VALID_BUSINESS_UNITS.has(businessUnit)) {
    throw new MetabaseApiError(`"businessUnit" inválido: ${businessUnit}`, 400);
  }
  if (!sendDate || !DATE_RE.test(sendDate)) {
    throw new MetabaseApiError('"sendDate" debe tener formato YYYY-MM-DD.', 400);
  }
}

/**
 * Punto de entrada por EMAIL (Grupo Control, sin cambios desde ADR 0006).
 * @param {{emails: string[], businessUnit: string, sendDate: string}} input
 * @returns {Promise<{conversions: number, totalSales: number}>}
 */
export async function fetchConversionsFromWarehouse({ emails, businessUnit, sendDate }) {
  const config = metabaseConfig();
  const cleanEmails = sanitizeEmails(emails);
  if (cleanEmails.length === 0) {
    return { conversions: 0, totalSales: 0 }; // segmento sin emails válidos: resultado válido en cero
  }
  assertBusinessUnitAndDate(businessUnit, sendDate);

  const batches = chunkArray(cleanEmails, BATCH_SIZE);
  let totalConversions = 0;
  let totalSales = 0;
  for (const emailBatch of batches) {
    const query = buildEmailSalesQuery({ emails: emailBatch, businessUnit, sendDate });
    const batchResult = await runAggregateQuery(query, config);
    totalConversions += batchResult.conversions;
    totalSales += batchResult.totalSales;
  }
  return { conversions: totalConversions, totalSales };
}

/**
 * Resuelve, deduplicados, los `customer_id` de silver.customers cuyo
 * email esté en `emails` O cuyo phone esté en `phones` (condición OR del
 * negocio, sesión "CORRECCIÓN FASE 2.2"). Se resuelve en dos rondas de
 * lotes independientes (una por email, otra por teléfono) y se deduplica
 * en memoria con un Set — así un cliente que matchee por las dos vías
 * nunca se cuenta dos veces en el agregado de ventas.
 */
async function collectMatchedCustomerIds({ emails, phones, businessUnit }, config) {
  const ids = new Set();

  for (const emailBatch of chunkArray(emails, BATCH_SIZE)) {
    const query = buildCustomersByEmailQuery({ emails: emailBatch, businessUnit });
    const rows = await runRowsQuery(query, config, BATCH_SIZE);
    for (const row of rows) {
      if (row?.customer_id != null) ids.add(String(row.customer_id));
    }
  }

  for (const phoneBatch of chunkArray(phones, BATCH_SIZE)) {
    const query = buildCustomersByPhoneQuery({ phones: phoneBatch, businessUnit });
    const rows = await runRowsQuery(query, config, BATCH_SIZE);
    for (const row of rows) {
      if (row?.customer_id != null) ids.add(String(row.customer_id));
    }
  }

  return Array.from(ids);
}

/** Agrega conversions/totalSales de silver.sales para un array (ya deduplicado) de customer_id. */
async function aggregateSalesForCustomerIds({ customerIds, businessUnit, sendDate }, config) {
  if (customerIds.length === 0) return { conversions: 0, totalSales: 0 };

  let totalConversions = 0;
  let totalSales = 0;
  for (const idBatch of chunkArray(customerIds, CUSTOMER_ID_BATCH_SIZE)) {
    const query = buildSalesByCustomerIdsQuery({ customerIds: idBatch, businessUnit, sendDate });
    const batchResult = await runAggregateQuery(query, config);
    totalConversions += batchResult.conversions;
    totalSales += batchResult.totalSales;
  }
  return { conversions: totalConversions, totalSales };
}

/**
 * Punto de entrada COMBINADO (Grupo SMS, "CORRECCIÓN FASE 2.2"): recibe
 * los emails que Hermes ya trajo de HubSpot para la lista que el usuario
 * escribió en el Grupo SMS Y los `telefonos_validos` que Éter extrajo del
 * CSV de Workingbits para la campaña elegida, y hace el match combinado
 * `(email IN (...) OR phone IN (...))` contra `silver.customers` antes de
 * agregar `silver.sales` — ver `collectMatchedCustomerIds`.
 * @param {{emails: string[], phones: string[], businessUnit: string, sendDate: string}} input
 * @returns {Promise<{conversions: number, totalSales: number}>}
 */
export async function fetchConversionsFromWarehouseCombined({ emails, phones, businessUnit, sendDate }) {
  const config = metabaseConfig();
  const cleanEmails = sanitizeEmails(emails);
  const cleanPhones = sanitizePhones(phones);
  if (cleanEmails.length === 0 && cleanPhones.length === 0) {
    return { conversions: 0, totalSales: 0 }; // sin emails ni teléfonos válidos: resultado válido en cero
  }
  assertBusinessUnitAndDate(businessUnit, sendDate);

  const customerIds = await collectMatchedCustomerIds({ emails: cleanEmails, phones: cleanPhones, businessUnit }, config);
  return aggregateSalesForCustomerIds({ customerIds, businessUnit, sendDate }, config);
}

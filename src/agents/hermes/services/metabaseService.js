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
// CORRECCIÓN DE ARQUITECTURA (mismo día, sesión de "pruebas de conexión"):
// la primera versión de este archivo asumía que se hablaba directo con la
// API REST de Metabase (`POST /api/dataset`, header `x-api-key`). El
// usuario encontró la credencial real de un proyecto anterior
// (`METABASE_MCP_URL`/`METABASE_MCP_KEY`) y, al probarla, resultó ser el
// servidor MCP `metabase-mcp` (el mismo conector de solo lectura que este
// asistente usa en desarrollo como `mcp__livo_metabase__*`) — NO la API
// REST de Metabase directamente. Se reescribió este archivo para hablar
// el protocolo real: JSON-RPC 2.0 sobre HTTP, con la respuesta en formato
// SSE (`Content-Type: text/event-stream`), autenticado con
// `?api_key=...` como query param en la URL (probado: un header
// `Authorization: Bearer`, `x-api-key` o `apikey` devuelven 401 contra
// este servidor — solo el query param funciona). Confirmado con pruebas
// reales contra `tools/list` y `tools/call` (`execute`) antes de dejarlo
// así — ver HANDOFF.md para el detalle de las pruebas.
//
// FIX 413 PAYLOAD TOO LARGE (mismo día, sesión de "buscar grupo falla"):
// la primera versión de fetchConversionsFromWarehouse mandaba UNA sola
// consulta con TODOS los emails del segmento interpolados en un
// `email IN (...)`. Para segmentos grandes de HubSpot (miles de
// contactos), el body del POST JSON-RPC superaba el límite del
// body-parser del servidor MCP (`supergateway`/`raw-body`) y este
// respondía 413 sin ejecutar nada. Se midió el límite real contra el
// servidor en vivo con requests sintéticos de tamaño creciente:
// 500/1000/2000/3000/3500 emails (12.6KB/25.1KB/52.1KB/79.1KB/92.6KB)
// devolvieron 200; 4000/5000 emails (106.1KB/133.1KB) devolvieron 413 —
// el límite real cae entre 92.6KB y 106.1KB (muy probablemente el default
// de 100KB de `raw-body`). Se eligió un tamaño de lote conservador,
// `EMAIL_BATCH_SIZE = 800` (~4x de margen bajo el límite medido,
// contemplando que emails reales pueden ser más largos que los
// sintéticos usados en la prueba), y ahora la función parte la lista de
// emails en lotes de ese tamaño, ejecuta una consulta `execute` por lote
// (secuencial, reusando los mismos filtros de fecha/business_unit/status)
// y suma `conversions`/`total_sales` de todos los lotes. Esto es
// matemáticamente seguro porque `email` es una clave de partición
// disjunta entre lotes (un mismo email no puede caer en dos lotes
// distintos, así que no hay doble conteo de ventas).
//
// PIVOTE FASE 2.1 (sesión "PIVOTE FASE 2.1 — Ingesta de CSV y
// Automatización de Calculadora"): se agregó `fetchConversionsFromWarehouseByPhone`,
// que cruza por TELÉFONO en vez de por email. Motivo: el Grupo SMS de la
// Calculadora ya no busca un segmento en HubSpot (ver ADR 0008) — Éter
// entrega directamente `telefonos_validos` desde el CSV de Workingbits
// (números limpios de indicativo de país). `silver.sales` NO tiene
// columna de teléfono (verificado contra el esquema real en esta sesión:
// solo `email`); el teléfono vive en `silver.customers.phone`, guardado
// SIN indicativo de país (ej. celulares de Colombia como "3143904965",
// 10 dígitos, verificado con datos reales). Por eso el cruce por teléfono
// necesita un JOIN: primero resolver `customer_id` en `silver.customers`
// por `phone` + `business_unit`, y con esos `customer_id` (ya
// deduplicados) sí hacer el `join` contra `silver.sales` — así se evita
// que un teléfono que por error matchee más de una fila de clientes
// duplique ventas en la suma (ver buildPhoneQuery, usa un
// `with matched_customers as (select distinct customer_id ...)`).
// El cruce por EMAIL (`fetchConversionsFromWarehouse`, sin cambios) se
// mantiene para el Grupo Control, que sigue usando búsqueda de lista de
// HubSpot como antes — ver ADR 0008 para por qué no se migró también el
// Grupo Control en este pivote.
//
// Reemplaza src/agents/minerva/utils/simulateConversions.js (eliminado en
// una sesión anterior). Contrato de negocio del cruce por EMAIL
// (verificado por el usuario contra el esquema real de `silver.sales` en
// la base DWH de Metabase):
//
//   1. Cruce por email: `email IN (...)` contra los correos que Hermes ya
//      trajo de HubSpot (ver hubspotService.js).
//   2. Ventana de atribución de 7 días: `created_at` entre `sendDate` y
//      `sendDate` + 6 días (7 días en total, contando el día del envío).
//   3. Filtro geográfico: `business_unit` = el código mapeado del país
//      seleccionado en el frontend (ver src/agents/minerva/constants/countries.js).
//   4. Exclusión de cancelaciones: cualquier `status` que contenga la
//      palabra "cancel" (case-insensitive) queda afuera — cubre
//      'canceled', 'CANCELADO', 'Pedido Cancelado-Pedido CANCELADO', etc.
//      sin tener que mantener una lista cerrada de variantes.
//
// El cruce por TELÉFONO (fetchConversionsFromWarehouseByPhone) aplica las
// mismas reglas 2-4, cambiando solo el paso 1: `phone IN (...)` contra
// `silver.customers` (no contra `silver.sales` directamente) para
// resolver `customer_id`, filtrado también por `business_unit` en esa
// misma tabla (evita que un mismo número, sin indicativo, matchee un
// cliente de otro país por coincidencia).
//
// Devuelve en ambos casos: { conversions, totalSales } — conversions =
// conteo de transacciones únicas válidas (`count(distinct sale_id)`),
// totalSales = suma de `gmv_usd` (revenue en USD) de esas mismas
// transacciones, agregados a través de todos los lotes.

export class MetabaseApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'MetabaseApiError';
    this.status = status;
  }
}

// Nombres de tabla/columna verificados contra el esquema real de
// `silver.sales`/`silver.customers` (base DWH, id=2 en Metabase) en la
// sesión del pivote de Fase 2.1: `silver.sales` tiene `sale_id`,
// `customer_id`, `business_unit`, `status`, `created_at`, `email`,
// `gmv_usd`; `silver.customers` tiene `customer_id`, `phone`,
// `business_unit` (sin columna de teléfono en `silver.sales`, por eso el
// cruce por teléfono necesita el join).
const SALES_TABLE = 'silver.sales';
const CUSTOMERS_TABLE = 'silver.customers';
const REVENUE_COLUMN = 'gmv_usd';

// Tamaño máximo de emails/teléfonos por consulta al MCP de Metabase — ver
// nota "FIX 413 PAYLOAD TOO LARGE" arriba para cómo se determinó este
// valor (medido con emails; se reutiliza el mismo margen conservador para
// teléfonos, que son más cortos que un email típico, así que el margen
// real es aún mayor).
const BATCH_SIZE = 800;

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

/**
 * Valida y normaliza la lista de correos que llega del cliente (originada
 * en los `contacts` que Hermes ya trajo de HubSpot). Descarta silenciosamente
 * cualquier valor que no tenga forma de email — nunca se interpola texto
 * sin validar en el SQL.
 */
function sanitizeEmails(emails) {
  const seen = new Set();
  for (const raw of Array.isArray(emails) ? emails : []) {
    if (typeof raw !== 'string') continue;
    const email = raw.trim().toLowerCase();
    if (email && EMAIL_RE.test(email)) seen.add(email);
  }
  return Array.from(seen);
}

/**
 * Valida y normaliza la lista de teléfonos que llega del cliente
 * (originada en `telefonos_validos`, ya limpios de indicativo por Éter —
 * ver src/agents/eter/utils/cleanPhoneNumber.js). Descarta silenciosamente
 * cualquier valor que no sea solo dígitos con longitud razonable.
 */
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

/** Cláusulas WHERE compartidas por ambas variantes (email/teléfono) sobre silver.sales. */
function sharedSalesWhere({ startDate, endDateExclusive, businessUnitLiteral }) {
  return `
      created_at >= ${startDate}::timestamp
      and created_at < ${endDateExclusive}::timestamp
      and business_unit = ${businessUnitLiteral}
      and status not ilike '%cancel%'
  `;
}

function buildEmailQuery({ emails, businessUnit, sendDate }) {
  const emailList = emails.map(sqlStringLiteral).join(', ');
  const startDate = sqlStringLiteral(sendDate);
  // Ventana de 7 DÍAS EN TOTAL contando el día del envío (día 0 al día 6),
  // no "sendDate + 7 días" (que darían 8 días). Se usa "< sendDate + 7 días"
  // (exclusivo) en vez de "<= sendDate + 6 días 23:59:59" para no depender
  // de la resolución de tiempo de `created_at` (timestamp sin zona horaria).
  const endDateExclusive = sqlStringLiteral(addDaysISO(sendDate, 7));
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

/**
 * Cruce por teléfono (pivote de Fase 2.1): primero resuelve
 * `customer_id` en `silver.customers` por `phone` + `business_unit` (con
 * `distinct` para no duplicar si un teléfono matcheara más de un
 * cliente), y con esos IDs ya deduplicados hace el join contra
 * `silver.sales` — evita fan-out en el join que inflaría `total_sales`.
 */
function buildPhoneQuery({ phones, businessUnit, sendDate }) {
  const phoneList = phones.map(sqlStringLiteral).join(', ');
  const startDate = sqlStringLiteral(sendDate);
  const endDateExclusive = sqlStringLiteral(addDaysISO(sendDate, 7));
  const businessUnitLiteral = sqlStringLiteral(businessUnit);

  return `
    with matched_customers as (
      select distinct customer_id
      from ${CUSTOMERS_TABLE}
      where phone in (${phoneList})
        and business_unit = ${businessUnitLiteral}
    )
    select
      count(distinct s.sale_id) as conversions,
      coalesce(sum(s.${REVENUE_COLUMN}), 0) as total_sales
    from ${SALES_TABLE} s
    join matched_customers mc on mc.customer_id = s.customer_id
    where ${sharedSalesWhere({ startDate, endDateExclusive, businessUnitLiteral }).trim()}
  `.trim();
}

/**
 * Parsea una respuesta del servidor MCP: el body llega en formato SSE
 * (una o más líneas `event: ...` / `data: {...}`), no como JSON plano —
 * ver la nota de "CORRECCIÓN DE ARQUITECTURA" arriba. Se toma el último
 * bloque `data:` (el servidor manda un único mensaje por request en este
 * uso, pero por robustez se toma el último si hubiera más de uno) y se
 * parsea como el JSON-RPC 2.0 de respuesta.
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

/**
 * Llama a una tool del servidor MCP de Metabase (`tools/call`) y devuelve
 * el texto de su primer bloque de contenido ya parseado como JSON (todas
 * las tools de este servidor devuelven un string con JSON adentro).
 */
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

/** Ejecuta `buildQueryFn` contra el MCP y devuelve { conversions, totalSales } de un lote. */
async function runBatchQuery(buildQueryFn, batchInput, config) {
  const query = buildQueryFn(batchInput);
  const result = await callMcpTool(
    'execute',
    { database_id: config.databaseId, query, row_limit: 5 },
    config
  );

  if (result?.success === false) {
    throw new MetabaseApiError('La consulta a Metabase no se ejecutó correctamente.', 502);
  }

  const row = result?.data?.['0'] ?? result?.data?.[0];
  return {
    conversions: Number(row?.conversions) || 0,
    totalSales: Number(row?.total_sales) || 0,
  };
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
 * Punto de entrada por EMAIL (Grupo Control, sin cambios en el pivote de
 * Fase 2.1). @see fetchConversionsFromWarehouseByPhone para el Grupo SMS.
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
    const batchResult = await runBatchQuery(
      buildEmailQuery,
      { emails: emailBatch, businessUnit, sendDate },
      config
    );
    totalConversions += batchResult.conversions;
    totalSales += batchResult.totalSales;
  }
  return { conversions: totalConversions, totalSales };
}

/**
 * Punto de entrada por TELÉFONO (Grupo SMS, pivote de Fase 2.1): recibe
 * `telefonos_validos` de la campaña procesada por Éter (ya limpios de
 * indicativo de país) y cruza vía `silver.customers.phone` ->
 * `silver.sales.customer_id`.
 * @param {{phones: string[], businessUnit: string, sendDate: string}} input
 * @returns {Promise<{conversions: number, totalSales: number}>}
 */
export async function fetchConversionsFromWarehouseByPhone({ phones, businessUnit, sendDate }) {
  const config = metabaseConfig();
  const cleanPhones = sanitizePhones(phones);
  if (cleanPhones.length === 0) {
    return { conversions: 0, totalSales: 0 }; // campaña sin teléfonos válidos: resultado válido en cero
  }
  assertBusinessUnitAndDate(businessUnit, sendDate);

  const batches = chunkArray(cleanPhones, BATCH_SIZE);
  let totalConversions = 0;
  let totalSales = 0;
  for (const phoneBatch of batches) {
    const batchResult = await runBatchQuery(
      buildPhoneQuery,
      { phones: phoneBatch, businessUnit, sendDate },
      config
    );
    totalConversions += batchResult.conversions;
    totalSales += batchResult.totalSales;
  }
  return { conversions: totalConversions, totalSales };
}

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
// Reemplaza src/agents/minerva/utils/simulateConversions.js (eliminado en
// esta misma sesión). Contrato de negocio (verificado por el usuario
// contra el esquema real de `silver.sales` en la base DWH de Metabase):
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
// Devuelve: { conversions, totalSales } — conversions = conteo de
// transacciones únicas válidas (`count(distinct sale_id)`), totalSales =
// suma de `gmv_usd` (revenue en USD) de esas mismas transacciones,
// agregados a través de todos los lotes de emails.

export class MetabaseApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'MetabaseApiError';
    this.status = status;
  }
}

// Nombre de la tabla y de la columna de fecha usados para el cruce.
// Verificado contra el esquema real de `silver.sales` (base DWH, id=2 en
// Metabase) en esta sesión: existen `email`, `business_unit`, `status`,
// `sale_id`, `created_at` y `gmv_usd` con esos tipos exactos. `created_at`
// es la columna de "fecha de compra" confirmada explícitamente por el
// usuario para la ventana de atribución de 7 días (sesión 2026-09-02,
// ajuste de integración Metabase). `gmv_usd` (revenue ya convertido a
// dólares) se usó como columna de ventas por instrucción explícita del
// usuario, en vez de `total` (que viene en la moneda local de cada
// business_unit — sumar `total` de países distintos habría mezclado
// monedas sin sentido; `gmv_usd` es comparable entre países).
const SALES_TABLE = 'silver.sales';
const REVENUE_COLUMN = 'gmv_usd';

// Tamaño máximo de emails por consulta al MCP de Metabase — ver nota
// "FIX 413 PAYLOAD TOO LARGE" arriba para cómo se determinó este valor.
const EMAIL_BATCH_SIZE = 800;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

function buildQuery({ emails, businessUnit, sendDate }) {
  const emailList = emails.map(sqlStringLiteral).join(', ');
  const startDate = sqlStringLiteral(sendDate);
  // Ventana de 7 DÍAS EN TOTAL contando el día del envío (día 0 al día 6),
  // no "sendDate + 7 días" (que darían 8 días). Se usa "< sendDate + 7 días"
  // (exclusivo) en vez de "<= sendDate + 6 días 23:59:59" para no depender
  // de la resolución de tiempo de `created_at` (timestamp sin zona horaria).
  // Ajustado el 2026-09-02 por instrucción explícita del usuario: la
  // versión anterior usaba `addDaysISO(sendDate, 8)`, que sumaba un día de
  // más (8 días de ventana en vez de 7).
  const endDateExclusive = sqlStringLiteral(addDaysISO(sendDate, 7));
  const businessUnitLiteral = sqlStringLiteral(businessUnit);

  return `
    select
      count(distinct sale_id) as conversions,
      coalesce(sum(${REVENUE_COLUMN}), 0) as total_sales
    from ${SALES_TABLE}
    where email in (${emailList})
      and created_at >= ${startDate}::timestamp
      and created_at < ${endDateExclusive}::timestamp
      and business_unit = ${businessUnitLiteral}
      and status not ilike '%cancel%'
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

/**
 * Ejecuta la consulta de conversiones para UN lote de emails (a lo sumo
 * EMAIL_BATCH_SIZE) y devuelve { conversions, totalSales } de ese lote.
 */
async function fetchConversionsForBatch({ emailBatch, businessUnit, sendDate }, config) {
  const query = buildQuery({ emails: emailBatch, businessUnit, sendDate });
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

/**
 * Punto de entrada único que /api/metabase/conversions.js debe llamar.
 * @param {{emails: string[], businessUnit: string, sendDate: string}} input
 *   sendDate en formato 'YYYY-MM-DD' (mismo formato del <input type="date">
 *   del formulario de la Calculadora).
 * @returns {Promise<{conversions: number, totalSales: number}>}
 */
export async function fetchConversionsFromWarehouse({ emails, businessUnit, sendDate }) {
  const config = metabaseConfig();

  const cleanEmails = sanitizeEmails(emails);
  if (cleanEmails.length === 0) {
    // Nada que cruzar (segmento sin emails válidos) — no es un error del
    // servidor, es un resultado válido en cero.
    return { conversions: 0, totalSales: 0 };
  }
  if (!businessUnit || !VALID_BUSINESS_UNITS.has(businessUnit)) {
    throw new MetabaseApiError(`"businessUnit" inválido: ${businessUnit}`, 400);
  }
  if (!sendDate || !DATE_RE.test(sendDate)) {
    throw new MetabaseApiError('"sendDate" debe tener formato YYYY-MM-DD.', 400);
  }

  // Segmentos grandes de HubSpot pueden traer miles de emails: se parte
  // la lista en lotes para no superar el límite de tamaño de body del
  // servidor MCP (ver nota "FIX 413 PAYLOAD TOO LARGE" al inicio del
  // archivo). Se ejecuta un lote a la vez (no en paralelo) para no
  // saturar al servidor MCP con ráfagas de queries simultáneas contra el
  // mismo warehouse.
  const batches = chunkArray(cleanEmails, EMAIL_BATCH_SIZE);

  let totalConversions = 0;
  let totalSales = 0;
  for (const emailBatch of batches) {
    const batchResult = await fetchConversionsForBatch(
      { emailBatch, businessUnit, sendDate },
      config
    );
    totalConversions += batchResult.conversions;
    totalSales += batchResult.totalSales;
  }

  return { conversions: totalConversions, totalSales };
}

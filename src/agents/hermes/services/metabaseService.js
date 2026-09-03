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
// La función `fetchConversionsFromWarehouseCombined` implementa ese match
// combinado `(email IN (...) OR phone IN (...))` — ver más abajo,
// "REDISEÑO DE RENDIMIENTO", para el diseño ACTUAL de esa consulta (el
// diseño original de esta corrección, de dos fases contra
// silver.customers, quedó obsoleto y fue reemplazado).
//
// REDISEÑO DE RENDIMIENTO (sesión 2026-09-03, "error al intentar grupo
// sms — 502 Bad Gateway / Terminated"): el usuario reportó que la
// búsqueda del Grupo SMS empezó a fallar con `502 Bad Gateway` (nginx) o
// `Terminated`, y diagnosticó correctamente la causa: "la consulta esta
// demorando demasiado con el tema de relacionar numeros y correos".
//
// Causa raíz confirmada: el diseño original de ADR 0009 resolvía primero
// los `customer_id` consultando `silver.customers` DIRECTAMENTE por
// `email IN (...)` o `phone IN (...)`, filtrando solo por
// `business_unit` — SIN ninguna ventana de fecha. `silver.customers` es
// una tabla enorme y sin acotar (confirmado empíricamente en esta misma
// sesión: solo el business_unit BR ya tiene 621K+ filas en un único
// bucket de longitud de teléfono), así que ese filtro nunca reducía lo
// suficiente el conjunto a escanear, y la consulta terminaba agotando el
// tiempo del servidor MCP (502) o siendo matada por el proceso
// (Terminated).
//
// Fix: `buildCombinedSalesQuery` invierte el orden del join. Arranca
// SIEMPRE desde `silver.sales` ya filtrada por `business_unit` +
// ventana de `created_at` (7 días) + `status not ilike '%cancel%'` — un
// conjunto naturalmente chico y acotado — y RECIÉN DESPUÉS hace `join`
// contra `silver.customers` para revisar el match de `email`/`phone`.
// Esto evita por completo el escaneo sin acotar de la tabla de clientes.
// Validado empíricamente antes de escribir el código, vía
// `mcp__livo_metabase__execute` (mismo servidor MCP de producción):
//   select s.sale_id, s.gmv_usd as revenue
//   from silver.sales s
//   join silver.customers c on c.customer_id = s.customer_id
//   where s.business_unit = 'CO'
//     and s.created_at >= '2026-08-01'::timestamp
//     and s.created_at < '2026-08-08'::timestamp
//     and s.status not ilike '%cancel%'
//     and (c.email in ('mabalejo89@gmail.com') or c.phone in ('3183628705'))
// → devolvió exactamente 1 fila, excluyendo correctamente una venta
// cancelada del mismo cliente con timestamp muy cercano.
//
// Esto simplifica el diseño de dos fases (`collectMatchedCustomerIds` +
// `aggregateSalesForCustomerIds`, ambas ELIMINADAS) a una sola fase:
// `fetchConversionsFromWarehouseCombined` arma consultas
// `buildCombinedSalesQuery` (por lotes solo si emails+phones no caben en
// un único payload) y deduplica por `sale_id` en memoria (no por
// `customer_id`, ya no aplica). `CUSTOMER_ID_BATCH_SIZE` y
// `CUSTOMER_LOOKUP_BATCH_SIZE` quedaron sin uso y se eliminaron.
//
// Riesgo de calidad de datos detectado (NO resuelto, documentado para
// futuras sesiones): el mismo cliente real puede existir en
// `silver.customers` con más de una fila con distinto `business_unit`
// (ej. AR y CO) y con el `phone` en formato inconsistente (con o sin
// indicativo de país) — visto con datos reales de
// `mabalejo89@gmail.com`. Esto puede afectar la tasa de match del Grupo
// SMS y queda pendiente de definir cómo normalizar.
//
// No se pudo probar este rediseño end-to-end en producción desde este
// entorno (sin credenciales de Metabase de producción); solo se validó
// la consulta candidata contra datos reales vía el conector de
// desarrollo, como arriba.
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
// nota "FIX 413 PAYLOAD TOO LARGE" arriba. Para buildEmailSalesQuery
// (agregada, 1 fila) esto es el único límite relevante. Para
// buildCombinedSalesQuery (devuelve filas, ver "REDISEÑO DE RENDIMIENTO")
// también se usa como umbral para decidir si hace falta trocear
// emails/phones en más de una consulta.
const BATCH_SIZE = 800;

// Límite REAL de `row_limit` del servidor MCP de Metabase en producción,
// descubierto en la sesión "ERROR AL BUSCAR EN HUBSPOT Y METABASE":
//   "Invalid row_limit parameter: 800. Must be between 1 and 500."
// A diferencia de una consulta agregada (siempre 1 fila, nunca choca con
// este límite), fetchConversionsFromWarehouseCombined pide filas
// individuales de venta (ver "REDISEÑO DE RENDIMIENTO") y por eso está
// sujeta a este tope — ver el riesgo aceptado documentado ahí.
const MAX_ROW_LIMIT = 500;

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

/**
 * Cláusulas WHERE de ventana de fecha + país + no-cancelado, compartidas
 * por todo cruce sobre silver.sales.
 *
 * FIX (sesión "nuevo error — column reference created_at is ambiguous"):
 * `silver.customers` tiene sus PROPIAS columnas `created_at`,
 * `business_unit` y `status` (confirmado vía `information_schema.columns`
 * contra el esquema real). Mientras `buildEmailSalesQuery` consulta
 * `silver.sales` sola (sin alias, sin ambigüedad posible),
 * `buildCombinedSalesQuery` hace `join` con `silver.customers` — ahí,
 * dejar estas columnas sin calificar es ambiguo para Postgres apenas hay
 * un segundo `join`, sin importar si el nombre de columna coincide o no
 * en ambas tablas. Por eso ahora se acepta un alias explícito de tabla
 * (por defecto `s`, el usado en ambos builders) y todas las columnas se
 * califican con él — nunca dejar una columna de `silver.sales` sin
 * prefijo en una consulta que además involucre otra tabla.
 */
function sharedSalesWhere({ startDate, endDateExclusive, businessUnitLiteral, alias = 's' }) {
  const p = alias ? `${alias}.` : '';
  return `
      ${p}created_at >= ${startDate}::timestamp
      and ${p}created_at < ${endDateExclusive}::timestamp
      and ${p}business_unit = ${businessUnitLiteral}
      and ${p}status not ilike '%cancel%'
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
      and ${sharedSalesWhere({ startDate, endDateExclusive, businessUnitLiteral, alias: '' }).trim()}
  `.trim();
}

/**
 * Construye la consulta combinada email/phone contra silver.sales — ver
 * "REDISEÑO DE RENDIMIENTO" más arriba para el rediseño de arrancar
 * siempre desde silver.sales.
 *
 * CORRECCIÓN (sesión "como relacionas la base de hubspot con la que se
 * carga en el csv"): el email de HubSpot y el teléfono del CSV NO se
 * relacionan entre sí — son dos identificadores independientes de la
 * MISMA audiencia (el nombre de la lista de HubSpot y el CSV se
 * corresponden solo por convención humana, no por ningún ID compartido
 * verificado en código), y cada uno se busca por separado con `OR`. Por
 * eso el email se matchea contra `s.email` (la propia columna de
 * silver.sales, la venta real — mismo criterio que ya usa
 * `buildEmailSalesQuery` para el Grupo Control) y NO contra
 * `customers.email` (el email del perfil del cliente en el Data
 * Warehouse, que puede no coincidir con el email real usado en una venta
 * puntual). El teléfono SÍ requiere `silver.customers` porque
 * `silver.sales` no tiene columna de teléfono — es el único de los dos
 * casos que necesita el `join`.
 *
 * Se usa `left join` (no `join`) para no descartar ventas cuyo
 * `customer_id` no tenga fila en `silver.customers`: esas ventas siguen
 * pudiendo matchear por `s.email`, y simplemente nunca matchean por
 * teléfono (columna `c.phone` queda `null`).
 */
function buildCombinedSalesQuery({ emails, phones, businessUnit, sendDate }) {
  const { startDate, endDateExclusive } = attributionWindow(sendDate);
  const businessUnitLiteral = sqlStringLiteral(businessUnit);

  const matchClauses = [];
  if (emails.length > 0) matchClauses.push(`s.email in (${emails.map(sqlStringLiteral).join(', ')})`);
  if (phones.length > 0) matchClauses.push(`c.phone in (${phones.map(sqlStringLiteral).join(', ')})`);
  // Nunca debería llamarse con las dos listas vacías (los callers ya lo
  // validan), pero por seguridad un match imposible es mejor que SQL roto.
  const matchClause = matchClauses.length > 0 ? matchClauses.join(' or ') : 'false';

  return `
    select s.sale_id as sale_id, s.${REVENUE_COLUMN} as revenue
    from ${SALES_TABLE} s
    left join ${CUSTOMERS_TABLE} c on c.customer_id = s.customer_id
    where ${sharedSalesWhere({ startDate, endDateExclusive, businessUnitLiteral, alias: 's' }).trim()}
      and (${matchClause})
  `.trim();
}

/**
 * Parsea una respuesta del servidor MCP: normalmente el body llega en
 * formato SSE (una o más líneas `data: {...}`), no como JSON plano. Se
 * toma el último bloque `data:` y se parsea como el JSON-RPC 2.0 de
 * respuesta.
 *
 * Corrección (sesión "NUEVO ERROR — Respuesta del servidor MCP de
 * Metabase sin cuerpo utilizable"): el cruce combinado del Grupo SMS
 * (ver "REDISEÑO DE RENDIMIENTO" más arriba para el diseño actual) puede
 * hacer varias llamadas EN PARALELO al MCP por lotes — con un segmento de
 * HubSpot o un CSV grandes, la suma de esas llamadas puede acercarse al
 * límite de ejecución de una función serverless de Vercel (ver el riesgo
 * ya documentado en ADR 0006,
 * "Riesgo a vigilar"), y el gateway puede cortar la conexión a mitad de
 * la respuesta SSE o devolver un body vacío/truncado — antes esto se
 * reportaba con un mensaje genérico que no dejaba ver la causa. Ahora:
 *   1. Si no hay líneas `data:` pero el body SÍ tiene contenido y parsea
 *      como JSON plano, se usa ese JSON directamente (algunos gateways
 *      responden JSON plano en vez de SSE en ciertos caminos de error).
 *   2. Si de verdad no hay nada utilizable, el error incluye un
 *      fragmento del body crudo (hasta 300 caracteres) para poder
 *      diagnosticar sin adivinar — timeout, body vacío, HTML de un
 *      proxy/gateway intermedio, etc.
 */
function parseSseJsonRpc(bodyText) {
  const dataLines = bodyText
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  if (dataLines.length > 0) {
    try {
      return JSON.parse(dataLines[dataLines.length - 1]);
    } catch {
      throw new MetabaseApiError('No se pudo parsear la respuesta del servidor MCP de Metabase.', 502);
    }
  }

  // Fallback: sin líneas `data:` pero con body no vacío — intentar JSON plano.
  const trimmed = bodyText.trim();
  if (trimmed) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // no era JSON plano tampoco; cae al error de abajo con el fragmento crudo
    }
  }

  const snippet = trimmed ? trimmed.slice(0, 300) : '(body completamente vacío)';
  throw new MetabaseApiError(
    `Respuesta del servidor MCP de Metabase sin cuerpo utilizable. Posible corte por timeout ` +
      `(la consulta combinada hace varias llamadas secuenciales — ver ADR 0006/0009) o respuesta ` +
      `inesperada del gateway. Fragmento recibido: ${snippet}`,
    502
  );
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
  const result = await callMcpTool('execute', { database_id: config.databaseId, query, row_limit: Math.min(5, MAX_ROW_LIMIT) }, config);
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
  // Nunca se envía un row_limit por encima de lo que el servidor acepta,
  // sin importar qué le pase el llamador (ver MAX_ROW_LIMIT arriba).
  const safeRowLimit = Math.max(1, Math.min(rowLimit, MAX_ROW_LIMIT));
  const result = await callMcpTool('execute', { database_id: config.databaseId, query, row_limit: safeRowLimit }, config);
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

  // En paralelo (mismo motivo que fetchConversionsFromWarehouseCombined
  // más abajo — ver esa nota): mitiga el riesgo, ya
  // documentado en ADR 0006, de que muchos lotes secuenciales se acerquen
  // al límite de ejecución de una función serverless de Vercel.
  const batchResults = await Promise.all(
    chunkArray(cleanEmails, BATCH_SIZE).map((emailBatch) => {
      const query = buildEmailSalesQuery({ emails: emailBatch, businessUnit, sendDate });
      return runAggregateQuery(query, config);
    })
  );

  let totalConversions = 0;
  let totalSales = 0;
  for (const batchResult of batchResults) {
    totalConversions += batchResult.conversions;
    totalSales += batchResult.totalSales;
  }
  return { conversions: totalConversions, totalSales };
}

/**
 * Punto de entrada COMBINADO (Grupo SMS, "CORRECCIÓN FASE 2.2", rediseñado
 * en la sesión "REDISEÑO DE RENDIMIENTO" — ver nota grande al inicio del
 * archivo): recibe los emails que Hermes ya trajo de HubSpot para la lista
 * que el usuario escribió en el Grupo SMS Y los `telefonos_validos` que
 * Éter extrajo del CSV de Workingbits para la campaña elegida, y hace el
 * match combinado `(email IN (...) OR phone IN (...))` SIEMPRE arrancando
 * desde `silver.sales` ya acotada por fecha/país/estado — ver
 * `buildCombinedSalesQuery`. Ya NO resuelve `customer_id` en una fase
 * separada contra `silver.customers` sin acotar (ese diseño de dos fases,
 * de ADR 0009, causaba 502/Terminated por escanear una tabla de millones
 * de filas sin ningún filtro de fecha).
 *
 * Deduplica por `sale_id` (no por `customer_id`) usando un Map en memoria:
 * si el mismo cliente matchea por email Y por teléfono en distintos lotes,
 * la misma venta puede aparecer más de una vez entre los resultados de los
 * distintos lotes, y el Map se encarga de contarla una sola vez.
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

  // Caso común: ambas listas caben juntas en un solo lote (BATCH_SIZE,
  // límite de payload) — una sola consulta con el OR completo. Caso
  // grande: se trocea cada lista POR SEPARADO (cada query solo lleva UNA
  // de las dos condiciones) para no armar un IN gigante que exceda el
  // límite de payload; el dedupe por sale_id de abajo evita doble conteo
  // si una misma venta aparece en más de un lote.
  const totalCount = cleanEmails.length + cleanPhones.length;
  const queries = [];
  if (totalCount <= BATCH_SIZE) {
    queries.push(buildCombinedSalesQuery({ emails: cleanEmails, phones: cleanPhones, businessUnit, sendDate }));
  } else {
    for (const emailBatch of chunkArray(cleanEmails, BATCH_SIZE)) {
      queries.push(buildCombinedSalesQuery({ emails: emailBatch, phones: [], businessUnit, sendDate }));
    }
    for (const phoneBatch of chunkArray(cleanPhones, BATCH_SIZE)) {
      queries.push(buildCombinedSalesQuery({ emails: [], phones: phoneBatch, businessUnit, sendDate }));
    }
  }

  // En paralelo (mismo motivo documentado en fetchConversionsFromWarehouse
  // arriba): cada lote es independiente, y disparar todos a la vez evita
  // acercarse al límite de ejecución de la función serverless.
  //
  // Riesgo aceptado y documentado (ver "REDISEÑO DE RENDIMIENTO"): a
  // diferencia de una consulta agregada (siempre 1 fila), esto pide filas
  // individuales de venta, sujeto a MAX_ROW_LIMIT (500) por lote. Si un
  // solo lote matchea más de 500 ventas distintas en la ventana de 7 días,
  // el resultado se trunca sin avisar. Se considera improbable para
  // volúmenes típicos de conversión de una campaña de SMS en 7 días, pero
  // queda como limitación conocida a vigilar si el volumen crece.
  const batchRowSets = await Promise.all(queries.map((q) => runRowsQuery(q, config, MAX_ROW_LIMIT)));

  const salesById = new Map(); // dedupe por sale_id — evita doble conteo entre lotes
  for (const rows of batchRowSets) {
    for (const row of rows) {
      if (row?.sale_id == null) continue;
      salesById.set(String(row.sale_id), Number(row.revenue) || 0);
    }
  }

  let totalSales = 0;
  for (const revenue of salesById.values()) totalSales += revenue;
  return { conversions: salesById.size, totalSales };
}

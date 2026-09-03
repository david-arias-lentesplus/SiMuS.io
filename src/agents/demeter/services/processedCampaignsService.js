import { supabase } from '../supabaseClient.js';

// Deméter — servicio de acceso a datos para `sms_processed_campaigns`
// (Fase 2.1, pivote de ingesta de CSV). Único módulo autorizado a
// consultar esta tabla — Minerva/Hefesto siempre pasan por el hook
// ../hooks/useProcessedCampaigns.js, nunca por este archivo directamente.
const TABLE = 'sms_processed_campaigns';

/**
 * Traduce una campaña agrupada por Éter (parseWorkingbitsCsv) a la fila
 * de la tabla.
 *
 * Fase 2.3: se agrega `communication_start_date` (migración 005) —
 * distinto de `send_date`, ver esa migración y parseWorkingbitsCsv.js.
 *
 * Fase 2.4 ("CORRECCIÓN FASE 2.4"): el país/tienda ya NO es un valor
 * único para todo el archivo — cada `group` trae su PROPIO
 * `countryValue`, resuelto por grupo en parseWorkingbitsCsv.js (fix del
 * bug que asignaba mal Brasil NL/LV cuando un CSV traía campañas
 * mezcladas). `fallbackCountryValue` solo se usa si, por algún motivo,
 * el grupo no trae su propio valor (defensivo — no debería pasar: Hefesto
 * resuelve cualquier grupo ambiguo antes de llamar a esta función).
 */
export function toProcessedCampaignRow(group, fallbackCountryValue) {
  return {
    campaign_name: group.campaignName,
    country_value: group.countryValue ?? fallbackCountryValue,
    send_date: group.fecha || null,
    communication_start_date: group.fechaComunicacion || null,
    message: group.mensaje || null,
    muestra_entregados: group.muestraEntregados,
    telefonos_validos: group.telefonosValidos,
    total_rows: group.totalRows,
  };
}

/**
 * Lista campañas procesadas. `countryValue` es opcional (filtra por país).
 *
 * Fase 2.5 ("VISTA DE GESTIÓN DE CAMPAÑAS CARGADAS"): el orden pasa de
 * `created_at DESC` a `send_date DESC` (lo que pidió el usuario para la
 * nueva vista /campanas-cargadas — quiere ver primero las campañas cuyo
 * envío es más reciente, no las cargadas/subidas más recientemente, que
 * no es lo mismo si alguien sube un CSV viejo después). `send_date` es
 * texto en formato `YYYY-MM-DD` desde el fix de Éter (Fase 2.4,
 * parseWorkingbitsDate.js), así que el orden lexicográfico coincide con
 * el cronológico; se agrega `created_at DESC` como desempate estable para
 * filas con `send_date` nulo o igual (nullsFirst:false para que esas
 * filas no salten al principio de la lista).
 */
export async function fetchProcessedCampaigns({ countryValue } = {}) {
  let query = supabase
    .from(TABLE)
    .select('*')
    .order('send_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (countryValue) query = query.eq('country_value', countryValue);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Inserta (o reemplaza, si ya existe una campaña con el mismo
 * `campaign_name`) el lote de campañas que Éter agrupó de un CSV.
 *
 * Corrección de Fase 2.2 ("MANEJO DE DUPLICADOS", ver ADR 0009 y la
 * migración 004): el identificador único de negocio es SOLO
 * `campaign_name` (el `Communication Name` del CSV) — no
 * `(campaign_name, country_value)` como se implementó por error en la
 * migración 003. Volver a subir un CSV con una campaña ya cargada
 * SOBREESCRIBE `muestra_entregados`, `telefonos_validos`, `send_date`,
 * `message` y `total_rows` de esa fila (incluida `country_value`, si el
 * usuario subió el CSV bajo un país distinto por error) en vez de crear
 * un duplicado. Postgres/PostgREST no distingue "la data es exactamente
 * igual" de "cambió" en un upsert — si no cambió nada, sobreescribe con
 * los mismos valores, lo cual es inofensivo (no es un insert nuevo).
 *
 * `countryValue` (Fase 2.4): ahora es OPCIONAL — solo se usa como
 * fallback si algún grupo no trajera su propio `countryValue` resuelto
 * (ver `toProcessedCampaignRow`). El caso normal es que cada grupo ya
 * venga con el suyo.
 */
export async function upsertProcessedCampaigns(groups, countryValue) {
  if (!Array.isArray(groups) || groups.length === 0) return [];
  const rows = groups.map((g) => toProcessedCampaignRow(g, countryValue));
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'campaign_name' })
    .select();
  if (error) throw error;
  return data;
}

export async function deleteProcessedCampaign(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

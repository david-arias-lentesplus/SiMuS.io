import { supabase } from '../supabaseClient.js';

// Deméter — servicio de acceso a datos para `sms_processed_campaigns`
// (Fase 2.1, pivote de ingesta de CSV). Único módulo autorizado a
// consultar esta tabla — Minerva/Hefesto siempre pasan por el hook
// ../hooks/useProcessedCampaigns.js, nunca por este archivo directamente.
const TABLE = 'sms_processed_campaigns';

/** Traduce una campaña agrupada por Éter (parseWorkingbitsCsv) a la fila de la tabla. */
export function toProcessedCampaignRow(group, countryValue) {
  return {
    campaign_name: group.campaignName,
    country_value: countryValue,
    send_date: group.fecha || null,
    message: group.mensaje || null,
    muestra_entregados: group.muestraEntregados,
    telefonos_validos: group.telefonosValidos,
    total_rows: group.totalRows,
  };
}

/** Lista campañas procesadas, más recientes primero. `countryValue` es opcional (filtra por país). */
export async function fetchProcessedCampaigns({ countryValue } = {}) {
  let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (countryValue) query = query.eq('country_value', countryValue);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Inserta (o reemplaza, si ya existe una campaña con el mismo nombre +
 * país) el lote de campañas que Éter agrupó de un CSV. Decisión de esta
 * sesión (documentada en .claude/agents/eter.md, "Pendiente de definir"):
 * volver a subir un CSV que incluya una campaña ya cargada REEMPLAZA esa
 * fila (upsert por `campaign_name, country_value`), no acumula duplicados.
 */
export async function upsertProcessedCampaigns(groups, countryValue) {
  if (!Array.isArray(groups) || groups.length === 0) return [];
  const rows = groups.map((g) => toProcessedCampaignRow(g, countryValue));
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'campaign_name,country_value' })
    .select();
  if (error) throw error;
  return data;
}

export async function deleteProcessedCampaign(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

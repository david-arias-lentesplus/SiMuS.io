import { supabase } from '../supabaseClient.js';

// Deméter — servicio de acceso a datos para la tabla sms_campaigns.
// Este es el único módulo autorizado a hacer queries a esa tabla
// (ver .claude/agents/demeter.md, "Reglas de arquitectura").
// Minerva consume estas funciones vía los hooks en ../hooks/, nunca
// directamente desde componentes de Hefesto.

const TABLE = 'sms_campaigns';

/**
 * Payload de entrada esperado (mismo shape que el objeto `m` que produce
 * computeMetrics() en el prototipo HTML original).
 * @typedef {Object} CampaignMetrics
 * @property {string} name
 * @property {string} countryName
 * @property {number} smsCost
 * @property {string} [sendDate]
 * @property {string} [smsMessage]
 * @property {string} [eventType]
 * @property {number} smsN
 * @property {number} smsC
 * @property {number} smsS
 * @property {number} ctrlN
 * @property {number} ctrlC
 * @property {number} ctrlS
 * @property {number} smsCR
 * @property {number} ctrlCR
 * @property {number} smsAOV
 * @property {number} ctrlAOV
 * @property {number} smsRPC
 * @property {number} ctrlRPC
 * @property {number} liftConv
 * @property {number} liftCR
 * @property {number} totalCost
 * @property {number} roiReal
 */

/** Traduce el objeto `m` de computeMetrics() al payload de la tabla. */
export function toCampaignRow(m) {
  return {
    campaign_name: m.name,
    country: m.countryName,
    sms_cost_unit: m.smsCost,
    send_date: m.sendDate || null,
    sms_message: m.smsMessage || null,
    event_type: m.eventType || null,
    sms_sample: m.smsN,
    sms_conv: m.smsC,
    sms_sales: m.smsS,
    ctrl_sample: m.ctrlN,
    ctrl_conv: m.ctrlC,
    ctrl_sales: m.ctrlS,
    sms_cr: m.smsCR,
    ctrl_cr: m.ctrlCR,
    sms_aov: m.smsAOV,
    ctrl_aov: m.ctrlAOV,
    sms_rpc: m.smsRPC,
    ctrl_rpc: m.ctrlRPC,
    lift_conv: m.liftConv,
    lift_cr: m.liftCR,
    total_sms_cost: m.totalCost,
    roi_real: m.roiReal,
  };
}

/** Lista todas las campañas, más recientes primero. */
export async function fetchCampaigns() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Inserta una campaña calculada. Recibe el objeto `m` de computeMetrics(). */
export async function insertCampaign(m) {
  const row = toCampaignRow(m);
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return data;
}

/** Elimina una campaña por id. */
export async function deleteCampaign(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/** Elimina todas las campañas. Usar con confirmación explícita en la UI. */
export async function deleteAllCampaigns() {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

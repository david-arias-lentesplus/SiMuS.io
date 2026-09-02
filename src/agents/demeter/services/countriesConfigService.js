import { supabase } from '../supabaseClient.js';

// Deméter — servicio de acceso a datos para `countries_config` (Fase 3,
// ADR 0007). Reemplaza el arreglo estático COUNTRIES de
// src/agents/minerva/constants/countries.js como fuente de verdad de
// países/tarifas; ese archivo se mantiene solo como fallback offline
// (ver useCampaignCalculator.js) y como referencia del seed de la
// migración 002.
const TABLE = 'countries_config';

/** Traduce el draft del formulario de /settings/countries a la fila de la tabla. */
export function toCountryConfigRow(input) {
  return {
    country_name: input.countryName,
    sms_price: Number(input.smsPrice),
    currency: (input.currency || 'USD').trim(),
    metabase_code: (input.metabaseCode || '').trim().toUpperCase(),
    is_active: input.isActive !== false,
  };
}

/** Lista países. `onlyActive` filtra los que están apagados del catálogo. */
export async function fetchCountriesConfig({ onlyActive = false } = {}) {
  let query = supabase.from(TABLE).select('*').order('country_name', { ascending: true });
  if (onlyActive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function insertCountryConfig(input) {
  const { data, error } = await supabase.from(TABLE).insert(toCountryConfigRow(input)).select().single();
  if (error) throw error;
  return data;
}

export async function updateCountryConfig(id, input) {
  const row = { ...toCountryConfigRow(input), updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from(TABLE).update(row).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCountryConfig(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

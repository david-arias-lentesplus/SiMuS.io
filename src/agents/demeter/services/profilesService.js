import { supabase } from '../supabaseClient.js';

// Deméter — servicio de acceso a datos para la tabla `profiles`
// (usuario interno + rol, dueña del esquema: Eleuthia consume esto vía
// su propio store, nunca hace queries a Supabase directo — ver ADR 0007).
const TABLE = 'profiles';

/** Perfil (con rol) de un usuario por id. `null` si no existe la fila todavía. */
export async function fetchProfile(userId) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Lista todos los perfiles — requiere ser admin (RLS lo exige del lado del servidor). */
export async function fetchAllProfiles() {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Cambia el rol de un usuario — requiere ser admin (RLS lo exige). */
export async function updateProfileRole(userId, role) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

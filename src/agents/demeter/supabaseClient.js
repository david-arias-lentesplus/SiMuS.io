import { createClient } from '@supabase/supabase-js';

// Deméter — único punto de creación del cliente Supabase.
// Regla dura: ningún otro módulo debe importar @supabase/supabase-js
// directamente ni instanciar createClient() por su cuenta.
//
// Seguridad: el prototipo HTML original traía SUPABASE_URL y
// SUPABASE_KEY hardcodeados en el archivo. Deméter los mueve a variables
// de entorno (Vite: import.meta.env.VITE_*) porque, aunque la anon key de
// Supabase está pensada para exponerse en el cliente, commitear la URL y
// la key en el repo impide rotarlas sin tocar código y las deja visibles
// en el historial de Git. Ver .env.example.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // No lanzamos error duro para no romper el build; los servicios que
  // consuman este cliente deben manejar el estado de error igualmente
  // (regla de HADES: todo componente/hook maneja estados de carga/error).
  console.warn(
    '[Demeter] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Copia .env.example a .env.local y complétalo.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

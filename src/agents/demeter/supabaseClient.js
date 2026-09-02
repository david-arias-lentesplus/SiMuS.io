import { createClient } from '@supabase/supabase-js';

// Deméter — único punto de creación del cliente Supabase.
// Regla dura: ningún otro módulo debe importar @supabase/supabase-js
// directamente ni instanciar createClient() por su cuenta.
//
// Seguridad: el prototipo HTML original traía SUPABASE_URL y
// SUPABASE_KEY hardcodeados en el archivo. Deméter los movió a variables
// de entorno para poder rotarlas sin tocar código y no dejarlas en el
// historial de Git.
//
// Nombres SIN prefijo VITE_ (decisión explícita del usuario, sesión
// 2026-09-02): normalmente en Vite estas variables se leerían como
// `import.meta.env.VITE_SUPABASE_URL`, pero el aviso de Vercel al
// configurar env vars ("Remove the public framework prefix...") llevó a
// sacarles el prefijo. Como Vite por defecto NO expone al cliente
// variables sin prefijo `VITE_`, `vite.config.js` las inyecta a mano vía
// `define` — por eso siguen leyéndose de `import.meta.env` acá, aunque el
// nombre real en `.env.local`/Vercel sea `SUPABASE_URL`/`SUPABASE_ANON_KEY`
// sin prefijo. Ver el comentario de `vite.config.js` para el mecanismo
// completo.
const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // No lanzamos error duro para no romper el build; los servicios que
  // consuman este cliente deben manejar el estado de error igualmente
  // (regla de HADES: todo componente/hook maneja estados de carga/error).
  console.warn(
    '[Demeter] Faltan SUPABASE_URL / SUPABASE_ANON_KEY. ' +
    'Copia .env.example a .env.local y complétalo (y revisa vite.config.js si cambiaste el nombre).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

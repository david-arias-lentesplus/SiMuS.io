import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Config base de Vite. Poseidón debe revisar/aprobar cualquier cambio de
// build antes de aplicarse (protocolo asesor-no-ejecutor, ver
// .claude/agents/poseidon.md).
//
// SUPABASE_URL / SUPABASE_ANON_KEY se exponen al cliente SIN el prefijo
// VITE_ (decisión explícita del usuario, sesión 2026-09-02, motivada por
// el aviso de Vercel al configurar env vars: "Remove the public framework
// prefix..."). Por defecto Vite solo inyecta en `import.meta.env` las
// variables prefijadas `VITE_`, así que acá las cargamos a mano con
// `loadEnv()` (tercer argumento '' = sin filtro de prefijo) y las
// exponemos una por una vía `define` — SOLO esas dos claves, nunca
// `HS_PAT` ni ninguna otra variable del entorno, para no perder la
// protección de que solo lo explícitamente listado acá llega al bundle
// del navegador. Ver .env.example y src/agents/demeter/supabaseClient.js.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      'import.meta.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL ?? ''),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY ?? ''),
    },
  };
});

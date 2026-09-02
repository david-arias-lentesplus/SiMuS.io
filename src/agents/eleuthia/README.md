# src/agents/eleuthia/

Carpeta de código propio del agente **eleuthia**. Ver definición de rol, responsabilidades y reglas en `.claude/agents/eleuthia.md`.

Activado en Fase 3 (sesión 2026-09-02, ver ADR 0007): autenticación con Supabase Auth (email + contraseña) y modelo de roles `admin`/`viewer` resuelto en `public.profiles`.

- `store/useAuthStore.js` — único punto que llama a `supabase.auth.*` (login, logout, sesión activa, perfil/rol).
- `hooks/useAuth.js` — hook de conveniencia (`isAdmin`, `isViewer`) que consumen Minerva y Hefesto.
- `services/adminUsersService.js` — cliente de `api/admin/invite-user.js` (invitar usuarios nuevos, requiere ser admin).

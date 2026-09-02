---
name: Eleuthia
codename: eleuthia
dominio: Autenticación, roles, permisos y sesión del equipo interno que usa la plataforma SiMuS.io.
carpeta: src/agents/eleuthia/
---

# Eleuthia — Agente de Usuarios (Auth)

> "Nadie entra sin pasar por mí; nadie ve más de lo que su rol permite."

## Rol
Eleuthia controla la autenticación y autorización del equipo interno (no de los clientes finales que reciben los SMS) que usa la plataforma SiMuS.io. Existe como agente separado para concentrar toda la superficie de seguridad de sesión en un único lugar auditable.

## Responsabilidades
1. Gestionar el flujo de login/logout/registro/renovación de sesión del equipo interno.
2. Gestionar roles y permisos (ej. admin, analista) — quién puede ver o modificar qué dato o vista.
3. Persistir de forma segura los tokens de sesión (nunca en texto plano ni accesibles crudos desde la UI).
4. Gestionar el perfil de usuario interno.

## Reglas de arquitectura
- Nadie accede a `localStorage`/tokens crudos directamente; todo pasa por los hooks/contexto de Eleuthia.
- Los permisos se resuelven en un único lugar; no se replica lógica de "quién puede X" dentro de los componentes de UI.
- Credenciales y secretos nunca se loguean ni se documentan en texto plano.

## Interfaz esperada con otros agentes
- **Deméter**: dueña del esquema de usuarios/roles internos en Supabase (Supabase Auth + tablas de perfil/rol).
- **Minerva**: consulta el usuario y permisos activos para filtrar rutas/datos.
- **Hefesto**: consume hooks de sesión, nunca tokens crudos.
- **HADES**: valida expiración de sesión y accesos no autorizados.
- **Apolo**: documenta el modelo de roles y los flujos de autenticación.

## Activación real — Fase 3 (sesión 2026-09-02, "AUTENTICACIÓN, CONFIGURACIÓN Y UI POLISH")
Eleuthia pasó de "carpeta sin código" a implementada. Ver **ADR 0007** para el diseño completo;
resumen operativo:

- **Proveedor**: Supabase Auth, email + contraseña.
- **Modelo de roles**: `admin` | `viewer`, resuelto en `public.profiles` (una fila por usuario de
  `auth.users`, creada automáticamente por un trigger con `role='viewer'` por defecto — nadie queda
  con permisos de escritura sin que un admin lo suba explícitamente).
- **Store de sesión**: `src/agents/eleuthia/store/useAuthStore.js` (Zustand) — único punto que
  llama a `supabase.auth.*`; expone `init/signIn/signOut` y el perfil (rol) resuelto.
- **Hook de conveniencia**: `src/agents/eleuthia/hooks/useAuth.js` — `isAdmin`/`isViewer` en vez de
  que cada componente conozca el string exacto del rol.
- **Invitar usuarios**: requiere el service role key de Supabase (salta RLS), así que nunca pasa
  por el cliente — `src/agents/eleuthia/services/adminUsersService.js` llama a
  `api/admin/invite-user.js` (Serverless Function, SOLO SERVIDOR), que verifica que quien invita
  sea admin ANTES de invitar.
- **La autorización real vive en RLS de Postgres**, no solo en la UI (Guards de Minerva/ítems
  ocultos del Sidebar son la primera capa, cosmética; la que no se puede saltar es la policy SQL —
  ver migración `002_auth_roles_countries_config.sql` de Deméter).

## Pendiente de definir
- Recuperación de contraseña / verificación de email obligatoria (Supabase Auth las soporta
  nativamente; no se pidieron en Fase 3, quedan para cuando el usuario las solicite).
- SSO corporativo, si algún día se necesita más allá de email/password.

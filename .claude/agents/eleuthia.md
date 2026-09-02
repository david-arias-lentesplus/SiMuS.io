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

## Pendiente de definir
- Proveedor exacto de autenticación (Supabase Auth con email/password, magic link, SSO corporativo).
- Matriz definitiva de roles y permisos.

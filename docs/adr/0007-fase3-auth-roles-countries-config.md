# ADR 0007 — Fase 3: autenticación (Eleuthia), roles admin/viewer, catálogo de países editable y pulido de UI

- **Fecha:** 2026-09-02
- **Estado:** Implementado, pendiente de aplicar en producción (migración SQL + variable de entorno nueva a cargo del usuario).
- **Agentes involucrados:** Eleuthia (activado en esta sesión), Deméter, Minerva, Hefesto.

## Contexto

El usuario envió una instrucción de sistema de agentes ("ATENCIÓN SISTEMA DE AGENTES: FASE 3 -
AUTENTICACIÓN, CONFIGURACIÓN Y UI POLISH") para que SiMuS.io deje de ser una app de un solo
"usuario implícito" sin login (hallazgo de la auditoría de la sesión anterior, `docs/fase3-analisis.md`
sección 2: cualquiera con la URL podía leer el histórico completo y aprobar/guardar campañas) y
evolucione a multiusuario con dos roles: `admin` y `viewer`. También pidió reemplazar el arreglo
estático de tarifas por país por una tabla editable, y corregir tres detalles de UI: decimales
sueltos en inputs numéricos, el círculo gris vacío del header, y una tabla de histórico sin límite
de filas visibles.

## Decisión

### 1. Modelo de roles y autenticación (Eleuthia)

Se usa **Supabase Auth** (email + contraseña) como proveedor, con una tabla `public.profiles` (1
fila por usuario de `auth.users`, columna `role` con check `in ('admin', 'viewer')`) como fuente de
verdad del rol — Supabase Auth no tiene un concepto nativo de "rol de negocio", solo autenticación.

Un trigger (`on_auth_user_created`, `security definer`) crea automáticamente la fila de `profiles`
con `role='viewer'` por defecto cada vez que se da de alta un usuario nuevo en `auth.users` (ya sea
por signup normal o por invitación admin vía `auth.admin.inviteUserByEmail`). Se eligió `viewer`
como default por seguridad: un usuario nuevo nunca queda con permisos de escritura sin que un admin
lo suba explícitamente.

`public.is_admin()` es una función SQL `security definer` que resuelve "¿el usuario autenticado
actual es admin?" leyendo `profiles` sin quedar bloqueada por la propia RLS de esa tabla (que
restringe `select` a "mi propia fila o admin" — para saber si soy admin necesito poder leer mi
propia fila incluso antes de saber si soy admin, y `security definer` resuelve esa dependencia
circular). Se reutiliza en las policies de `profiles`, `countries_config` y `sms_campaigns`.

**Matriz de permisos implementada** (todo por RLS de Postgres, no solo en el cliente):

| Acción | admin | viewer |
|---|---|---|
| Ver Dashboard / Histórico | Sí | Sí |
| Calcular y guardar campaña nueva (`/calculadora`) | Sí | No (ruta oculta + RLS de `sms_campaigns.insert` exige `is_admin()`) |
| Eliminar campaña / "eliminar todo" | Sí | No (RLS de `sms_campaigns.delete`) |
| Ver/editar catálogo de países (`/settings/countries`) | Sí | No (ruta oculta + RLS de `countries_config` para insert/update/delete) |
| Ver/gestionar usuarios (`/settings/users`) | Sí | No (ruta oculta; `profiles.select` de otras filas exige `is_admin()`) |
| Invitar usuarios nuevos | Sí (vía `api/admin/invite-user.js`) | No (esa ruta verifica `is_admin()` del lado del servidor antes de invitar) |

La UI (Guards de Minerva, ítems ocultos del Sidebar) es solo la primera capa — la exigible de
verdad es la RLS en Postgres, así que ni un viewer con DevTools abierto puede saltarse el límite.

### 2. Invitar usuarios: por qué una API Route con service role key

`supabase.auth.admin.inviteUserByEmail` solo existe con el **service role key** (nunca el anon
key) — es la API administrativa de Supabase Auth para crear usuarios sin que ellos mismos hagan
signup. El service role key salta toda RLS, así que nunca puede llegar al cliente (mismo patrón de
aislamiento que `HS_PAT`/`METABASE_MCP_KEY`, ver ADR 0004/0006): vive solo en
`process.env.SUPABASE_SERVICE_ROLE_KEY`, sin prefijo `VITE_`, sin entrada en el `define` de
`vite.config.js`.

`api/admin/invite-user.js` (nueva Serverless Function, mismo patrón de ubicación que
`api/hubspot/segment.js`/`api/metabase/conversions.js` — raíz del repo, Vercel lo exige en
proyectos Vite) recibe `{ email, role }` más el JWT de la sesión del que invita (header
`Authorization: Bearer <access_token>`), verifica con ese mismo cliente de servicio que el token es
válido y que el usuario detrás tiene `role='admin'` en `profiles` — **nunca confía en un rol que
venga del body del request** — y solo entonces invita y ajusta el rol del invitado.

### 3. `countries_config`: reemplaza el arreglo estático `COUNTRIES`

Nueva tabla (migración `002_auth_roles_countries_config.sql`) con `country_name`, `sms_price`,
`currency`, `metabase_code` (mismo valor que hoy vive en `businessUnit` dentro de `countries.js` —
el código exacto de `silver.sales.business_unit` que usa Hermes) e `is_active`. RLS: cualquier
autenticado puede leer (la Calculadora la necesita); solo admin puede escribir.

`src/agents/minerva/hooks/useCampaignCalculator.js` ahora consume
`src/agents/demeter/hooks/useCountriesConfig.js` (`{ onlyActive: true }`) en vez de importar el
arreglo estático. **`src/agents/minerva/constants/countries.js` no se borró** — se mantiene como
(a) el seed exacto que carga la migración, para que Fase 3 no rompa la Calculadora el día del
deploy, y (b) fallback defensivo si la tabla no responde (RLS aplicado a medias, red caída): en vez
de dejar la Calculadora sin países, el hook cae a ese arreglo. Documentado en el propio archivo.

`CalculatorPage`/`CampaignForm` casi no cambiaron: seguían esperando `{value, label, costPerSms,
businessUnit}` por país, así que el hook solo traduce las filas de `countries_config` a esa misma
forma (`value` = `id` de la fila en vez del slug estático anterior).

### 4. Corrección de decimales (Hefesto)

QA reportó inputs numéricos mostrando basura de punto flotante (`13084,510000000002`). Causa: los
`<input type="number">` editables de `CampaignForm.jsx` (los campos de "Total ventas") pintan el
valor crudo del estado del formulario directo, sin pasar por `fmt$()`/`fmtN()` — esos formatters
solo se usan en vistas de solo lectura (`CalculatorReport.jsx`, `HistoryPage.jsx`). El valor crudo
venía de sumar varios lotes de `gmv_usd` en `metabaseService.js` (ver ADR 0006, fix de 413), lo que
puede reintroducir imprecisión de punto flotante típica de JS.

Fix en dos puntos: (a) raíz del problema — `round2()` (nuevo helper en `format.js`) se aplica en
`useCampaignCalculator.searchSegment()` al recibir `totalSales` de Metabase, antes de guardarlo en
el formulario; (b) red de seguridad — `NumberField` en `CampaignForm.jsx` redondea a 2 decimales en
`onBlur` para los campos de dinero (`step="0.01"`), por si alguien pega o edita un valor con más
decimales a mano.

### 5. UserMenu (Hefesto)

`src/agents/hefesto/components/UserMenu.jsx` reemplaza el círculo gris vacío del `Topbar`:
iniciales derivadas del correo, rol visible, menú desplegable con "Configuración" (solo si
`isAdmin`) y "Cerrar sesión" (`useAuth().signOut()`). Consume exclusivamente el hook de sesión de
Eleuthia — nunca llama a `supabase.auth.*` directo (regla dura de ese agente).

### 6. Paginación del Histórico (Hefesto)

Paginación **client-side** (`PAGE_SIZE = 20`) sobre el arreglo ya filtrado/ordenado por Minerva —
`useFilteredCampaigns` sigue trayendo todas las filas de Supabase sin límite (Deméter no pagina la
query todavía). Se eligió así para no tocar la capa de datos en esta misma entrega y porque el
volumen actual (decenas de campañas) no lo justifica todavía. **Mejora futura anotada, no
bloqueante**: si el histórico crece a varios miles de filas, la paginación real debería moverse a
la query (`range()` de Supabase) en `smsCampaignsService.fetchCampaigns()`.

## Consecuencias

- **Cero autenticación hoy -> RLS real desde este deploy.** A diferencia de la migración
  `001_sms_campaigns.sql` (que dejó las policies de `sms_campaigns` abiertas a "cualquier
  autenticado" como placeholder porque no existía login), esta migración SÍ activa RLS con
  distinción de rol real. **Advertencia de orden de despliegue** (repetida como comentario dentro
  del propio SQL): la migración y el deploy del frontend con login deben coordinarse en la misma
  ventana — entre aplicar la migración y que el frontend tenga sesión real, la anon key sin
  autenticar deja de poder leer/escribir absolutamente nada en `sms_campaigns`/`countries_config`.
- **Primer admin: paso manual obligatorio.** Nadie puede ser admin hasta que el usuario corra a
  mano, una sola vez, en el SQL Editor de Supabase:
  `update public.profiles set role = 'admin' where email = 'tu-correo@dominio.com';`
  (después de que ese usuario exista en `auth.users` — signup normal o alta manual desde el
  Dashboard de Supabase). Documentado en el propio archivo de migración.
- **Nueva variable de entorno server-only:** `SUPABASE_SERVICE_ROLE_KEY` (Project Settings -> API
  en el Dashboard de Supabase). Debe configurarse en Vercel igual que `HS_PAT`/`METABASE_MCP_KEY`;
  sin ella, `api/admin/invite-user.js` responde 500 explicando qué falta.
- **No se implementó "olvidé mi contraseña" ni verificación de email obligatoria** — Supabase Auth
  las soporta nativamente (flujos de recovery/confirm por correo) pero no fueron pedidas
  explícitamente en esta Fase 3; queda como pendiente natural para Eleuthia si el usuario lo pide.
- **La Calculadora ahora depende de que `countries_config` responda** (con fallback al catálogo
  estático si falla) — un cambio de tarifa ya no requiere un deploy de código, se edita desde
  `/settings/countries`.
- **No se pudo probar el flujo completo end-to-end** (signup, login, invitación por correo real,
  RLS real contra el proyecto de producción) desde este entorno de desarrollo — misma limitación de
  siempre (sin `vercel dev`/`npm run build` en este puente). Todo el código nuevo se validó con
  `node --check` (los `.js` puros: hooks, servicios, la API Route, el store de Zustand) y revisión
  manual línea por línea (los `.jsx`, que `node --check` no puede parsear al no ser JS puro — mismo
  criterio usado en toda esta carpeta desde Fase 1). El usuario debe: aplicar la
  migración, cargar `SUPABASE_SERVICE_ROLE_KEY` en Vercel, promover al primer admin, y probar el
  flujo de login/roles/invitación en un despliegue real.

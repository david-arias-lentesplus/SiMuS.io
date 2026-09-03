# HANDOFF — SiMuS.io

> Bitácora técnica viva del proyecto. Mantenida por Apolo. Se actualiza al final de cada sesión de trabajo relevante, nunca retroactivamente. Lo obsoleto se mueve a la sección de Historial, no se borra.

Última actualización: 2026-09-02 (Fase 3 — autenticación, roles admin/viewer y `countries_config`, ADR 0007).

---

## 1. Objetivo del proyecto

Desarrollar una plataforma para extraer, consolidar y analizar las métricas de envío de SMS. El sistema integra:

- **HubSpot** — fuente de verdad de la base de clientes.
- **Workingbits** — proveedor y gateway de envío de SMS (retención de solo 90 días).
- **Supabase** — base de datos central, para persistir los registros de envío de forma permanente y superar la limitación de retención de Workingbits.
- **GitHub** — control de versiones.
- **Vercel** — hosting/despliegue.

## 2. Estado actual

- [x] Sesión 2026-09-01: se recibió `AGENTS_SYSTEM_HANDOFF.md` (patrón de sistema de agentes de Proyecto Faro) y se adaptó a los dominios de SiMuS.io.
- [x] Sesión 2026-09-01: se creó la estructura completa del sistema de agentes (ver sección 3).
- [x] Sesión 2026-09-01 (Fase 1): stack de frontend decidido — React + Vite + Tailwind + Zustand + react-router-dom (ver ADR 0003). Resuelve el punto de framework pendiente.
- [x] Sesión 2026-09-01 (Fase 1): esquema inicial de `sms_campaigns` creado en `src/agents/demeter/schema/001_sms_campaigns.sql` (aún no aplicado a un proyecto Supabase real — falta que el usuario provea/confirme el proyecto y se ejecute la migración).
- [x] Sesión 2026-09-01 (Fase 1): andamiaje de código inicial creado (rutas, estado global, layout, servicios de datos) a partir del prototipo HTML `calculadoraroisms010926.html` y la referencia visual `image_dfbb87.png` que el usuario adjuntó.
- [x] Sesión 2026-09-02 (pivote de Fase 1): formulario completo de la **Calculadora Híbrida** migrado a `CalculatorPage.jsx` (ver sección 7 para el detalle de archivos). La integración directa con la API de Workingbits sigue bloqueada; se reemplazó por ingreso manual + búsqueda de segmento simulada (HubSpot/Metabase).
- [x] Sesión 2026-09-01: tabla de histórico completa migrada a `HistoryPage.jsx` (búsqueda, orden por columna, export CSV, eliminar fila/eliminar todo con confirmación).
- [x] Sesión 2026-09-02: gráfica de actividad implementada con datos reales de Supabase (`useCampaignActivitySeries.js` + `ActivityChart.jsx`, Chart.js). Pendiente de que el usuario despliegue para confirmarla visualmente en producción.
- [x] Sesión 2026-09-02: corregido el 404 de Vercel al recargar rutas de cliente (`/calculadora`, `/historico`) — faltaba `vercel.json` con rewrite a `index.html` excluyendo `/api/*`. Pendiente de deploy.
- [x] ~~**Hallazgo de la auditoría de esta sesión, no resuelto:** la app no tiene autenticación (`src/agents/eleuthia/` solo tiene el README) — cualquiera con la URL puede leer el histórico completo y aprobar/guardar campañas.~~ **Resuelto en sesión 2026-09-02 (Fase 3)**: login con Supabase Auth + roles `admin`/`viewer` reales, exigidos por RLS en Postgres, no solo en el cliente. Ver ADR 0007 y sección 7.
- [x] Sesión 2026-09-02 (Fase 3): activado el agente Eleuthia — login, roles `admin`/`viewer`, Guards de ruta (Minerva), catálogo de países editable `countries_config` (Deméter, reemplaza el arreglo estático), vista de Gestión de Usuarios + invitación por correo (`api/admin/invite-user.js`), y pulido de UI (UserMenu, corrección de decimales, paginación del Histórico). Código extraído y validado con `node --check` en el dispositivo del usuario; **pendiente que el usuario aplique la migración SQL, promueva al primer admin y cargue `SUPABASE_SERVICE_ROLE_KEY` en Vercel** (ver ADR 0007 sección Consecuencias y sección 4 de este archivo).
- [x] Sesión 2026-09-02 (ajuste de integración Metabase): cruce real de conversiones y ventas implementado — ver ADR 0006. `simulateConversions.js` eliminado; `useCampaignCalculator.searchSegment()` ahora completa tamaño de muestra, conversiones Y ventas totales, las tres reales. Corregido el mismo día: la conexión real es a un servidor MCP (`metabase-mcp`), no a la API REST de Metabase — reescrito y probado end-to-end con datos reales (ver ADR 0006). `METABASE_MCP_URL`/`METABASE_MCP_KEY`/`METABASE_DATABASE_ID` ya están en `.env.local`; pendiente que el usuario los copie a Vercel y valide en producción.
- [x] Sesión 2026-09-02 (fix 413 Payload Too Large): `fetchConversionsFromWarehouse` ahora parte la lista de emails en lotes de `EMAIL_BATCH_SIZE = 800` (medido empíricamente contra el servidor MCP real — el límite real cae entre 92.6KB y 106.1KB de body) y suma resultados entre lotes. Ver ADR 0006 (addendum) y HANDOFF sección 7 para el detalle de las mediciones. Pendiente que el usuario confirme en Vercel que el botón "Buscar" ya no falla con 413 para grupos grandes.
- [x] Sesión 2026-09-01: `.env.local` completado y corregido (tenía sintaxis inválida: comillas y `;` como si fuera JS, en vez de `CLAVE=valor` plano). El Dashboard ya conecta al proyecto Supabase real (`qzothtkbqnorwmhgxktw`) y confirma 17 campañas históricas reales (jun-2026).
- [x] Sesión 2026-09-01: se detectó y corrigió un bug de Minerva — el filtro de fecha por defecto (`dateRange: '30d'`) ocultaba TODO el histórico real (más antiguo que 30 días) tanto en el Dashboard como en Histórico. Default corregido a `'all'`.
- [ ] **NO aplicar todavía** el bloque de RLS de `001_sms_campaigns.sql` contra el proyecto real: se verificó que hoy la tabla acepta lectura con la anon key sin autenticación (no hay login construido); restringir a rol `authenticated` rompería la app hasta que Eleuthia defina auth. Ver advertencia en el propio archivo SQL.
- [ ] Decidir con el usuario si se aplican las columnas nuevas/índices de `001_sms_campaigns.sql` a la tabla real (hoy son `if not exists`, no deberían romper nada, pero falta ejecutarlo con permisos de administrador — el MCP de Supabase conectado a esta sesión no tiene ese proyecto listado, así que requiere acceso manual del usuario al SQL Editor de Supabase o vincular el proyecto correcto al conector).
- [ ] Definir política de RLS real por rol — bloqueado por la matriz de roles de Eleuthia.
- [ ] Definir mecanismo de autenticación con HubSpot y de extracción de Workingbits — ver `.claude/agents/hermes.md` y `.claude/agents/iris.md`.
- [ ] Inicializar repositorio Git y proyecto Vercel — pendiente de que Poseidón proponga los comandos.
- [x] Sesión 2026-09-01 (Fase 1): ya existe el primer código de producto (ver `src/` fuera de `src/agents/*/README.md`): configuración de Vite/Tailwind, capa de datos de Deméter, rutas/estado de Minerva, layout y páginas placeholder de Hefesto.

## 3. Sistema de carpetas

```
SiMuS.io/
├── AGENTS_SYSTEM_HANDOFF.md      # Patrón reutilizable de sistema de agentes (fuente: Proyecto Faro)
├── HANDOFF.md                     # Este archivo — bitácora técnica viva de SiMuS.io
├── README.md                      # Puerta de entrada del proyecto
├── .claude/
│   └── agents/                    # Definición de rol de cada agente (los "prompts" que un asistente IA lee)
│       ├── hermes.md               (integración HubSpot)
│       ├── iris.md                 (integración Workingbits)
│       ├── demeter.md              (persistencia Supabase)
│       ├── hefesto.md              (UX/UI del dashboard)
│       ├── minerva.md              (rutas / estado global)
│       ├── eleuthia.md             (autenticación / roles internos)
│       ├── hades.md                (QA/testing, con veto)
│       ├── apolo.md                (documentación)
│       └── poseidon.md             (DevOps, sin carpeta de código)
├── src/
│   └── agents/                    # Código propio de cada agente (todos salvo Poseidón)
│       ├── hermes/
│       ├── iris/
│       ├── demeter/
│       ├── hefesto/
│       ├── minerva/
│       ├── eleuthia/
│       ├── hades/
│       └── apolo/
└── docs/
    └── adr/                        # Architecture Decision Records
        ├── 0001-adopcion-sistema-de-agentes.md
        └── 0002-supabase-como-persistencia-central.md
```

## 4. Tareas a seguir (próxima sesión)

0. **Usuario**: en Vercel, renombrar las variables de Supabase de `VITE_SUPABASE_URL`/
   `VITE_SUPABASE_ANON_KEY` a `SUPABASE_URL`/`SUPABASE_ANON_KEY` (mismo valor, nuevo nombre) para
   que coincidan con lo que el código espera desde esta sesión (ver ADR 0005). Si no se renombran,
   el deploy de producción pierde la conexión a Supabase silenciosamente.

0. ~~**Iris**: definir e implementar el cruce real de conversiones~~ — **Resuelto en sesión
   2026-09-02 ("ajuste de integración Metabase"), pero implementado en Hermes por instrucción
   explícita del usuario, no en Iris** (ver ADR 0006 y la nota de dominio en
   `.claude/agents/hermes.md`/`.claude/agents/iris.md`). El usuario verificó que `silver.sales`
   (base DWH, distinta de `ss.silver_sales` que se había explorado antes) sí tiene columna
   `email`. Código: `src/agents/hermes/services/metabaseService.js` + `api/metabase/conversions.js`
   + `src/agents/minerva/utils/fetchConversionsFromMetabase.js`. `simulateConversions.js` fue
   eliminado. `METABASE_DATABASE_ID=2` confirmado por el usuario como el mismo id en cualquier
   entorno. `created_at` confirmado explícitamente por el usuario como la columna correcta de
   "fecha de compra". **Corrección de arquitectura, mismo día:** el usuario encontró la credencial
   real de un proyecto anterior (`METABASE_MCP_URL`/`METABASE_MCP_KEY`) y, al probarla, resultó
   ser el servidor MCP `metabase-mcp` (JSON-RPC 2.0 + SSE, auth por `?api_key=` en la URL — NO la
   API REST de Metabase que se había asumido). `metabaseService.js` se reescribió para hablar ese
   protocolo y se probó end-to-end contra datos reales (un email real de `silver.sales` devolvió
   exactamente el `{conversions, totalSales}` esperado — ver ADR 0006 para el detalle completo de
   las pruebas). Los tres valores ya están en `.env.local`. **Sigue pendiente:**
   - Que el usuario copie `METABASE_MCP_URL`/`METABASE_MCP_KEY`/`METABASE_DATABASE_ID` a Vercel.
   - Confirmar si conviene generar una API key de Metabase MCP dedicada a SiMuS.io en vez de seguir
     usando la de un proyecto anterior (riesgo: si ese proyecto la rota, esto se rompe sin aviso).
   - Probar el flujo completo (Calculadora -> API Route -> servicio -> MCP) en un despliegue real
     de Vercel — lo probado en esta sesión fue una llamada directa al servidor MCP desde el
     entorno de desarrollo, no el pipeline completo.
   - ~~Fix de 413 Payload Too Large al buscar grupos con segmentos grandes~~ — **Resuelto en
     esta misma sesión** con batching de emails (`EMAIL_BATCH_SIZE = 800`), ver ADR 0006 addendum.
     Falta que el usuario lo confirme en Vercel.
   - ~~Ventana de atribución trayendo 8 días en vez de 7~~ — **Resuelto en esta misma sesión**:
     `addDaysISO(sendDate, 8)` -> `addDaysISO(sendDate, 7)` en `buildQuery()`, ver ADR 0006 addendum.
     Falta que el usuario confirme en Vercel que los números bajan de forma consistente.
0. **Usuario**: configurar `HS_PAT` (Private App Token de HubSpot) en `.env.local` para probar
   localmente con `vercel dev`, y en Vercel Project Settings -> Environment Variables para
   producción. Ver `.env.example` y ADR 0004.

0. ~~**Hermes / Iris**: reemplazar la simulación de búsqueda de segmentos por una llamada real~~ — Hecho en sesión 2026-09-02 (Fase 2) para el tamaño de muestra (HubSpot, vía Hermes). **Sigue pendiente**: las *conversiones* siguen simuladas en `src/agents/minerva/utils/simulateConversions.js` porque dependen del cruce con Metabase/Workingbits — eso es Iris, no Hermes, y todavía no está integrado.

1. **Poseidón**: proponer (nunca ejecutar) los comandos para inicializar el repositorio Git, el proyecto en GitHub y el andamiaje inicial del código (framework a elegir junto con Hefesto/Minerva).
2. ~~**Hefesto + Minerva**: decidir el stack de frontend~~ — Hecho en sesión 2026-09-01 (Fase 1): React + Vite + Tailwind + Zustand, ver ADR 0003.
3. **Deméter**: el esquema de `sms_campaigns` (campañas ya calculadas) está creado; falta diseñar las tablas de clientes (Hermes/HubSpot) y eventos crudos de envío (Iris/Workingbits) cuando esos agentes definan su mecanismo de integración — sí requiere ADR por ser decisión de modelado relevante.
4. **Hermes**: definir el método de autenticación con HubSpot (OAuth app vs. Private App token).
5. **Iris**: definir el mecanismo de extracción de Workingbits (webhook vs. polling) antes de que cualquier dato real corra riesgo de expirar a los 90 días.
6. ~~**Eleuthia**: definir la matriz de roles/permisos del equipo interno.~~ — **Resuelto en
   sesión 2026-09-02 (Fase 3)**: Supabase Auth + roles `admin`/`viewer` reales (RLS en Postgres,
   ver ADR 0007). **Sigue pendiente, a cargo del usuario:**
   - Aplicar la migración `002_auth_roles_countries_config.sql` y desplegar el frontend con login
     en la misma ventana (ver advertencia de orden en ADR 0007).
   - Promover al primer admin a mano en el SQL Editor de Supabase (comando exacto en ADR 0007 y en
     el propio archivo de migración).
   - Cargar `SUPABASE_SERVICE_ROLE_KEY` en Vercel (Project Settings -> Environment Variables) para
     que funcione la invitación de usuarios.
   - Probar el flujo real de login/roles/invitación en un despliegue real — no se pudo probar
     end-to-end desde este entorno de desarrollo.
   - Pendiente natural, no pedido en Fase 3: recuperación de contraseña / verificación de email
     obligatoria.
7. **Apolo**: mantener este HANDOFF y el README actualizados a medida que se resuelvan los puntos anteriores.

## 5. Registro de errores / incidencias

_Sin incidencias registradas todavía. HADES documentará aquí cada rechazo relevante y su resolución; Apolo mantiene este registro._

| Fecha | Agente que reporta | Descripción | Resolución |
|---|---|---|---|
| 2026-09-02 | Usuario (reportado en producción, después del deploy) | La gráfica de "Actividad de Campañas" rompía toda la app en producción con `Uncaught Error: "bar" is not a registered controller.` — `ActivityChart.jsx` registraba escalas/elementos de Chart.js (`BarElement`, `LineElement`, etc.) pero no los *controllers* (`BarController`, `LineController`), que Chart.js v4 exige por separado. | Corregido: se agregó `BarController` y `LineController` al import y al `ChartJS.register(...)` en `src/agents/hefesto/components/ActivityChart.jsx`. No se pudo probar en un navegador real dentro de este puente (sin `npm run build`); el usuario debe confirmar tras el próximo deploy. |
| 2026-09-02 | Usuario (reportado en producción, después de subir el ajuste de `gmv_usd`) | El botón "Buscar" de un grupo en la Calculadora fallaba con `413: PayloadTooLargeError: request entity too large` (body-parser del servidor MCP de Metabase) y no traía datos — la consulta interpolaba todos los emails del segmento en un único `email IN (...)`, y para segmentos grandes el body superaba el límite del servidor. | Corregido: `metabaseService.js` ahora parte los emails en lotes de `EMAIL_BATCH_SIZE = 800` (medido empíricamente: 3500 emails/92.6KB devolvió 200, 4000/106.1KB devolvió 413) y suma `conversions`/`total_sales` entre lotes. Validado con `node --check` y mediciones de payload contra el servidor real; no se pudo probar el flujo completo en un navegador real desde este puente — el usuario debe confirmar en Vercel. |
| 2026-09-02 | Apolo (detectado durante verificación de la Calculadora Híbrida) | `npm run build` falla (`Cannot find module @rollup/rollup-linux-arm64-gnu`); `npm install` para corregirlo falla con `EACCES` dentro de esta sesión. | No bloqueó la entrega — código validado con `node --check` + revisión manual. Pendiente: usuario corre `rm -rf node_modules package-lock.json && npm install` en su propia terminal (ver Historial, sesión 2026-09-02). |
| 2026-09-02 | Apolo (Fase 2, integración HubSpot) | No se pudo probar `vercel dev` / la ruta `/api/hubspot/segment` end-to-end dentro de esta sesión (sin CLI de Vercel autenticada, y bloqueado además por la incidencia de `npm install` de la fila anterior). | No bloqueó la entrega — código validado con `node --check` + revisión manual. Pendiente: el usuario prueba con `vercel dev` (o despliega a Vercel) en su propia máquina, con `HS_PAT` configurado. |
| 2026-09-02 | Apolo (env vars sin prefijo VITE_) | No se pudo correr `npm run dev`/build para confirmar que la app sigue conectando a Supabase después de sacarle el prefijo VITE_ a SUPABASE_URL/SUPABASE_ANON_KEY (misma incidencia de entorno de sesiones anteriores). | No bloqueó la entrega — código validado con `node --check` + revisión manual del mecanismo `loadEnv`/`define` de Vite. Pendiente: el usuario confirma en su máquina Y renombra las variables en Vercel (ver tarea 0 de la sección 4). |

## 6. Decisiones de arquitectura relevantes

Ver `docs/adr/`. Resumen:

- **ADR 0001**: adopción del sistema de 9 agentes especializados (adaptado del patrón de Proyecto Faro).
- **ADR 0002**: Supabase como persistencia central para superar el límite de 90 días de retención de Workingbits.

## 7. Historial

### Sesión 2026-09-02 (Fase 3 — Autenticación, roles admin/viewer, `countries_config` y pulido de UI, ADR 0007)

Instrucción de sistema de agentes recibida: activar a **Eleuthia** (auth/usuarios) y llevar a SiMuS.io
de "un solo usuario implícito" a multiusuario con roles reales, reemplazar el catálogo estático de
países por una tabla editable, y resolver tres detalles de UI detectados en QA (decimales sueltos,
círculo gris vacío del header, histórico sin límite de filas). Detalle completo de decisiones en
`docs/adr/0007-fase3-auth-roles-countries-config.md`.

- **Eleuthia (auth y roles)**: Supabase Auth (email + contraseña). `public.profiles` (trigger
  `security definer` que crea la fila con `role='viewer'` por defecto al alta de cada usuario) como
  fuente de verdad del rol. `public.is_admin()` (`security definer`) resuelve la dependencia
  circular de RLS. `useAuthStore.js` (Zustand, único punto que llama `supabase.auth.*`) +
  `useAuth.js` (hook de conveniencia: `isAdmin`, `isViewer`). Vista "Gestión de Usuarios"
  (`/settings/users`, solo admin) invita por correo vía `api/admin/invite-user.js` (Serverless
  Function nueva, usa `SUPABASE_SERVICE_ROLE_KEY` del lado del servidor, nunca en el cliente —
  verifica el rol del que invita contra `profiles` antes de invitar, nunca confía en el rol que
  venga del body del request).
- **Deméter (persistencia)**: migración `002_auth_roles_countries_config.sql` — tablas `profiles` y
  `countries_config` (`country_name`, `sms_price`, `currency`, `metabase_code`, `is_active`) con RLS
  real, más RLS por fin real (no placeholder) en `sms_campaigns`, gateada por `is_admin()`. Hooks
  `useCountriesConfig.js`/`useProfiles.js` y servicios `countriesConfigService.js`/
  `profilesService.js` nuevos.
- **Minerva (rutas y estado)**: `AuthGate.jsx` resuelve la sesión una sola vez al montar la app;
  `RequireAuth.jsx`/`RequireAdmin.jsx` protegen `/calculadora`, `/settings/countries` y
  `/settings/users` (sin sesión -> `/login`; sin rol admin en ruta admin-only -> `/`).
  `useCampaignCalculator.js` ahora consume `countries_config` vía el hook de Deméter en vez del
  arreglo estático (que se conserva como seed de la migración y fallback defensivo, ver ADR 0007).
- **Hefesto (UI/UX)**: `LoginPage.jsx` y el layout de `/settings` (`SettingsLayout.jsx` +
  `CountriesSettingsPage.jsx`/`UsersSettingsPage.jsx`) con la estética de siempre (tarjetas blancas,
  gradiente de marca) y el nuevo token `bg-blue-deep` en `tailwind.config.js`. `UserMenu.jsx`
  reemplaza el círculo gris vacío del `Topbar` (iniciales, rol, "Configuración" solo admin, "Cerrar
  sesión"). Corrección de decimales: `round2()` nuevo en `format.js`, aplicado en el origen
  (`useCampaignCalculator.searchSegment()`, sobre `totalSales` de Metabase) y como red de seguridad
  en el `onBlur` de los campos de dinero de `CampaignForm.jsx` (bug de QA `13084,510000000002`
  resuelto). `HistoryPage.jsx` con paginación client-side (`PAGE_SIZE = 20`); botones de eliminar
  (individual y "eliminar todo") ahora solo se renderizan si `isAdmin`. `Sidebar.jsx` oculta
  "Calculadora" y "Configuración" para viewers; botón de salir (antes decorativo) ahora funciona.

**Validación realizada**: todos los `.js` nuevos pasaron `node --check` en el dispositivo del
usuario tras la extracción (hooks, servicios, la API Route, el store de Zustand, `tailwind.config.js`).
Los `.jsx` se revisaron manualmente línea por línea (mismo criterio usado desde Fase 1, ya que
`node --check` no parsea JSX) y se verificó de forma cruzada que las rutas de import entre archivos
nuevos son consistentes (todos los componentes que necesitan sesión importan `useAuth` desde
`src/agents/eleuthia/hooks/useAuth.js`; los servicios de Deméter importan el cliente de Supabase
desde `src/agents/demeter/supabaseClient.js`). No se pudo correr `npm run build`/`vercel dev` ni
probar el flujo end-to-end (signup, login, invitación real, RLS contra producción) desde este
entorno de desarrollo — misma limitación de siempre.

**Pendiente a cargo del usuario, orden importa (ver ADR 0007 sección Consecuencias):**
1. Aplicar la migración `002_auth_roles_countries_config.sql` y desplegar el frontend con login **en
   la misma ventana** — entre aplicar la migración y tener el frontend con sesión real, la anon key
   sin autenticar no puede leer ni escribir nada en `sms_campaigns`/`countries_config`.
2. Promover al primer admin a mano, una sola vez, en el SQL Editor de Supabase:
   `update public.profiles set role = 'admin' where email = 'tu-correo@dominio.com';`
3. Cargar `SUPABASE_SERVICE_ROLE_KEY` (Project Settings -> API en el Dashboard de Supabase) en las
   variables de entorno de Vercel — sin ella, `api/admin/invite-user.js` responde 500. Se dejó un
   placeholder vacío y documentado en `.env.local` para desarrollo local.
4. Probar el flujo real de login/roles/invitación en un despliegue real.


### Sesión 2026-09-02 (ajuste de integración Metabase — cruce real de conversiones, agentes Hermes y Deméter)

El usuario envió una instrucción de sistema de agentes corrigiendo el hallazgo de la sesión
anterior (que había concluido que el warehouse no tenía columna de cliente para cruzar ventas
contra HubSpot): verificó que la tabla **`silver.sales`** (schema `silver`, base **DWH** —
distinta de `ss.silver_sales` en `livo_command_center`, que fue la que se exploró antes) sí tiene
una columna `email` directamente usable, y dio la especificación exacta de 4 filtros de negocio
obligatorios para el cruce.

Verificado en esta sesión contra el esquema real de `silver.sales` (vía el conector de solo
lectura usado en desarrollo): existen `email`, `business_unit`, `status`, `sale_id`, `created_at`
y `total` con los tipos esperados. Los valores reales de `business_unit` confirman el mapeo que
dio el usuario (`CO`, `AR`, `CL`, `MX`, `BR`, `LV` existen como códigos reales en la columna,
aunque también existe un `NL` separado — el usuario confirmó que "Brasil NL" mapea a `BR`, no a
`NL`, a pesar de la coincidencia de nombre). Los valores reales de `status` confirman que un
`NOT ILIKE '%cancel%'` cubre todas las variantes de cancelación mencionadas (`canceled`,
`CANCELADO`, `Pedido Cancelado-Pedido CANCELADO`, `Cancelado`, etc.) sin necesidad de mantener una
lista cerrada.

Entregado en esta sesión — **implementado en Hermes por instrucción explícita del usuario, no en
Iris** (ver nota de dominio en `.claude/agents/hermes.md`/`.claude/agents/iris.md` y el detalle
completo en **ADR 0006**, nuevo):

- `src/agents/minerva/constants/countries.js`: se agregó `businessUnit` a cada país (único lugar
  donde vive este mapeo).
- `src/agents/hermes/services/metabaseService.js` (NUEVO, SOLO SERVIDOR): construye y ejecuta el
  SQL nativo contra `silver.sales` vía la API REST de Metabase (`POST /api/dataset`, autenticado
  con API key en el header `x-api-key`, mismo patrón que `HS_PAT` para HubSpot — ver ADR 0004).
  Aplica los 4 filtros exactamente como los especificó el usuario: `email IN (...)` (con
  validación de forma de cada email antes de interpolar), ventana `created_at` entre `sendDate` y
  `sendDate + 7 días`, `business_unit = <mapeado>` (contra una whitelist cerrada de 6 valores), y
  `status NOT ILIKE '%cancel%'`. Devuelve `{ conversions, totalSales }` —
  `count(distinct sale_id)` y `sum(total)` respectivamente.
- `api/metabase/conversions.js` (NUEVO, raíz del repo — mismo motivo que `api/hubspot/segment.js`,
  Vercel exige que las Serverless Functions vivan en `/api` en un proyecto Vite): único punto HTTP
  que el cliente puede llamar, `POST { emails, businessUnit, sendDate }` -> `{ conversions,
  totalSales }`.
- `src/agents/minerva/utils/fetchConversionsFromMetabase.js` (NUEVO): cliente de esa ruta,
  reemplaza a `simulateConversions.js` (**eliminado** en esta sesión).
- `src/agents/minerva/hooks/useCampaignCalculator.js`: `searchSegment()` ahora encadena
  HubSpot (tamaño de muestra + emails) -> Metabase (conversiones + ventas reales) y completa los
  tres campos (`N`, `C`, `S`) del grupo correspondiente con datos reales — antes `S` ("Total
  ventas") se dejaba siempre en manual porque no existía ninguna fuente real para completarlo.
  Se agregó una validación: si el usuario no eligió fecha de envío, el botón "Buscar" muestra un
  error pidiéndosela antes de gastar la consulta a HubSpot.
- `src/agents/hefesto/components/calculator/SegmentLookupField.jsx`: copy actualizado — ya no
  dice "conversiones simuladas" en ningún lado; el botón de carga dice "Buscando en HubSpot +
  Metabase...".
- `.env.example`/`.env.local`: se agregaron `METABASE_URL`, `METABASE_API_KEY` y
  `METABASE_DATABASE_ID` (sin prefijo `VITE_`, mismo patrón que `HS_PAT` — nunca deben llegar al
  cliente). **El usuario debe completar los valores reales** antes de que esto funcione en
  cualquier entorno; en `.env.local` quedaron vacíos.
- **ADR 0006** (nuevo): documenta la decisión completa, incluida la excepción de dominio
  (Metabase implementado en Hermes en vez de Iris, por instrucción explícita del usuario) y los
  puntos que quedan pendientes de confirmar con el equipo de datos.

**Pendiente explícito para el usuario / próxima sesión** (repetido también en la sección 4):
configurar las tres variables de Metabase en Vercel; confirmar que `METABASE_DATABASE_ID=2` sea
correcto en la instancia de producción (no solo en el entorno de desarrollo usado para verificar
el esquema); confirmar si `created_at` es la columna correcta de "fecha de compra" o si debería
ser otra; y probar el flujo completo en un navegador real con un segmento y fecha conocidos, ya
que — como en toda esta carpeta desde que empezó la incidencia de `npm install`/Rollup — no se
pudo correr `vercel dev` dentro de este puente para probarlo end-to-end. Todo el código nuevo se
validó con `node --check` (los `.js`) y revisión manual (el único `.jsx` tocado, `SegmentLookupField.jsx`,
fue un cambio de copy sin lógica nueva).

**Actualización, mismo día:** el usuario respondió a los 4 pendientes de arriba. Confirmó que
`METABASE_DATABASE_ID` es el mismo en cualquier entorno (el conector habla directo con la
instancia real) — se dejó `METABASE_DATABASE_ID=2` ya cargado en `.env.local`. Confirmó
`created_at` como la columna correcta de "fecha de compra" — se actualizó el comentario en
`metabaseService.js` para reflejar que es una decisión confirmada, no una suposición. Pidió que
`.env.local` se completara también con `METABASE_URL`/`METABASE_API_KEY` "que proporciona el
conector MCP" — **no fue posible**: se intentó (`retrieve` sobre la base id=2 vía el conector) y
la API de Metabase no devuelve host/usuario/API key de la conexión en esa respuesta bajo ningún
parámetro disponible en las herramientas de este asistente; ese dato simplemente no está expuesto
por ningún tool del conector. Se dejó en `.env.local` un comentario explicando esto y dónde
conseguir esos dos valores a mano (URL: la que usa el usuario para entrar a Metabase en el
navegador; API key: Metabase -> Admin settings -> Authentication -> API Keys, requiere permisos de
administrador). El usuario dijo que con estos ajustes prueba directamente en Vercel.

**Segunda actualización, mismo día — corrección de arquitectura:** el usuario encontró una
credencial real de un proyecto anterior (`METABASE_MCP_URL=https://mcp.livocompany.com/metabase/mcp`
+ `METABASE_MCP_KEY=...`) y pidió replicarla acá y probar la conexión. Se probó con `curl` directo
contra el endpoint (varias formas de autenticación: `Authorization: Bearer` y `x-api-key`/`apikey`
como headers devolvieron 401; `?api_key=...` como query param funcionó) y resultó ser **el
servidor MCP `metabase-mcp` v1.1.5** — el mismo conector de solo lectura que este asistente usa en
desarrollo (`mcp__livo_metabase__*`), NO la API REST de Metabase que se había asumido al escribir
la primera versión de `metabaseService.js`. Confirmado con `tools/list` (mismas 6 tools:
`search`, `retrieve`, `list`, `execute`, `export`, `clear_cache`) y con una **prueba end-to-end
real**: se armó exactamente el SQL que arma el servicio (email + ventana de 7 días + business_unit
+ exclusión de canceladas) con un email real tomado de `silver.sales`
(`mabalejo89@gmail.com`, venta de `total=16278` el 2026-08-01 en `CO`) y el resultado devuelto fue
`{conversions: 1, total_sales: 16278}` — exactamente lo esperado.

`src/agents/hermes/services/metabaseService.js` se reescribió por completo para hablar el
protocolo real (JSON-RPC 2.0 sobre HTTP POST, respuesta en formato SSE, autenticado con
`?api_key=` en la URL — nunca por header) en vez de la API REST de Metabase asumida antes. Las env
vars cambiaron de nombre: `METABASE_URL`/`METABASE_API_KEY` -> `METABASE_MCP_URL`/`METABASE_MCP_KEY`
(mismo significado de "no exponer al cliente", mismo patrón que `HS_PAT`). Los tres valores reales
(URL, key y `METABASE_DATABASE_ID=2`) ya quedaron en `.env.local` — el usuario los copia a Vercel
para probar. `.env.example`, ADR 0006 y esta misma entrada de HANDOFF se actualizaron para
reflejar el protocolo correcto.

**Riesgo que queda documentado, no resuelto:** `METABASE_MCP_KEY` es una credencial de un proyecto
anterior, no generada específicamente para SiMuS.io — si ese proyecto la rota/revoca, esta
integración se rompe sin aviso. Vale la pena que el usuario confirme si conviene pedir una API key
nueva y dedicada en el servidor MCP.

**Tercera actualización, mismo día — último ajuste antes de desplegar:** el usuario pidió usar
`gmv_usd` (revenue ya convertido a dólares) en vez de `total` (moneda local de cada
`business_unit`) para la columna de ventas. Cambio de una línea en `metabaseService.js`
(`REVENUE_COLUMN`). Se aprovechó para notar que esto también corrige una inconsistencia que ya
existía: la etiqueta del campo en la Calculadora dice "Total ventas SMS (USD)"
(`CampaignForm.jsx`), pero con `total` el dato real era moneda local, no dólares — con `gmv_usd`
la etiqueta ahora sí describe lo que muestra. Verificado con la misma venta real usada para probar
la integración: `total=16278` (moneda local) -> `gmv_usd=4.35`. Con este ajuste el usuario dijo
que ya sube a Vercel.


**Cuarta actualización, mismo día — fix de 413 Payload Too Large al buscar un grupo:** el usuario
reportó, tras subir el ajuste de `gmv_usd` a Vercel, que el botón "Buscar" de un grupo en la
Calculadora fallaba con `Servidor MCP de Metabase respondió 413: ... PayloadTooLargeError: request
entity too large ... at readStream (.../supergateway/node_modules/body-parser/node_modules/raw-body/index.js:163:17)`
y no traía datos. Causa: la consulta original interpolaba TODOS los emails del segmento de HubSpot
en un único `email IN (...)` — para segmentos grandes (miles de contactos) el body del POST
JSON-RPC superaba el límite del body-parser del servidor MCP.

Se midió el límite real contra el servidor en vivo con requests sintéticos de tamaño creciente
(mismo shape exacto que produce el código): 500/1000/2000/3000/3500 emails (12.6KB/25.1KB/52.1KB/
79.1KB/92.6KB) devolvieron 200; 4000/5000 emails (106.1KB/133.1KB) devolvieron 413 — el límite real
cae entre 92.6KB y 106.1KB (muy probablemente el default de 100KB de `raw-body`, la librería del
stack trace).

Fix en `src/agents/hermes/services/metabaseService.js`: se agregó `EMAIL_BATCH_SIZE = 800`
(~4x de margen bajo el límite medido) y la función `fetchConversionsFromWarehouse` ahora parte la
lista de emails sanitizada en lotes de ese tamaño, ejecuta una consulta `execute` por lote
(secuencial, reutilizando los mismos filtros de business_unit/sendDate/status) y suma
`conversions`/`total_sales` de todos los lotes — seguro porque `email` es una clave de partición
disjunta entre lotes, así que no hay doble conteo. `api/metabase/conversions.js` y el resto de la
cadena (cliente, hook de la Calculadora) no cambiaron — el batching es interno y transparente.
Validado con `node --check` (sintaxis OK) y con las mediciones de payload de la tabla arriba contra
el servidor MCP real; no se pudo probar el flujo completo en un navegador real contra un segmento
grande desde este entorno de desarrollo (misma limitación de siempre, sin `vercel dev` en este
puente) — el usuario debe confirmar en Vercel que "Buscar" ya no falla con 413. Detalle completo,
incluida la tabla de mediciones y una nota sobre el límite de tiempo de ejecución de Vercel para
segmentos muy grandes, en el addendum de **ADR 0006**.

**Quinta actualización, mismo día — corrección de la ventana de atribución (7 días, no 8):** el
usuario reportó que la consulta estaba trayendo datos con el día del envío MÁS 7 días (8 días en
total), cuando la ventana debía ser de 7 días en total contando el día del envío. Causa: el límite
superior exclusivo del rango se calculaba con `addDaysISO(sendDate, 8)`, que en la práctica cubre
`sendDate` hasta `sendDate + 7` (8 días calendario). Corregido a `addDaysISO(sendDate, 7)` en
`buildQuery()` (`src/agents/hermes/services/metabaseService.js`) — ahora la ventana cubre
`sendDate` hasta `sendDate + 6` (7 días en total). Validado con `node --check`; no se pudo
re-verificar contra el servidor MCP en vivo con una venta real conocida en esta ventana específica
desde este entorno — es un cambio aritmético de un solo valor sobre una función ya probada
end-to-end, pero el usuario debe confirmar en Vercel que los números bajan de forma consistente.
Detalle completo en el addendum de **ADR 0006**.

### Sesión 2026-09-02 (fix de routing SPA, gráfica de actividad real, auditoría en vivo y exploración de Iris/Metabase)

El usuario pidió, en un solo mensaje con capturas del deploy en vivo, cuatro cosas mientras
resolvía otros temas en paralelo: (1) reemplazar el placeholder de la gráfica "Actividad de
Campañas" del Dashboard por datos reales de Supabase, (2) arreglar el 404 de Vercel al recargar
rutas de cliente como `/calculadora`, (3) auditar `https://simus-one.vercel.app/` y proponer
mejoras para la siguiente fase, y (4) intentar usar el conector `livo_metabase` para traer
conversiones reales (7 días post-envío) cruzando una lista/segmento de HubSpot contra ventas del
DWH — la pieza que hoy sigue simulada en `simulateConversions.js` (dominio de Iris).

Entregado en esta sesión:

- **Minerva + Hefesto (punto 1, chart real):** `src/agents/minerva/hooks/useCampaignActivitySeries.js`
  (agrega las campañas ya filtradas por `useFilteredCampaigns` en series por día o por mes según el
  rango de fechas — cambia automáticamente a agrupación mensual si el rango supera 21 días — con SMS
  enviados y ROI real promedio por bucket), `src/agents/hefesto/tokens/chartColors.js` (paleta
  dedicada, ya que los tokens `metric.*` existentes son de eventos de entrega que Iris aún no
  provee — documentado en `src/agents/hefesto/tokens/README.md`), y
  `src/agents/hefesto/components/ActivityChart.jsx` (Chart.js mixto: barras de SMS enviados + línea
  de ROI real promedio, dos ejes Y). `DashboardPage.jsx` ahora renderiza esto con estados de carga,
  error y "sin datos" en vez del placeholder fijo.
- **Fix de routing (punto 2):** `vercel.json` nuevo en la raíz del repo, con un rewrite que manda
  todo a `index.html` excepto `/api/*` — es la causa confirmada del 404 al recargar rutas de
  cliente (Vercel, sin este archivo, solo sirve rutas que existen como archivos físicos).
- **Auditoría del sitio en vivo + recomendaciones (punto 3):** ver `docs/fase3-analisis.md`
  (nuevo). Resumen: se confirmó en el navegador el bug del punto 2 y el placeholder del punto 1
  (ambos ya corregidos arriba, pendientes de deploy); se confirmó que la integración HubSpot de
  Fase 2 funciona end-to-end en producción; y se detectó un hallazgo no pedido pero relevante — la
  app no tiene ninguna autenticación (`src/agents/eleuthia/` solo tiene el README), así que
  cualquiera con la URL puede leer el histórico completo y aprobar/guardar campañas nuevas. Se
  agregó como recomendación de mayor prioridad para la siguiente fase.
- **Exploración de Iris/Metabase (punto 4):** con el conector `livo_metabase` (solo lectura) se
  ubicó la tabla de ventas correcta, `ss.silver_sales` (base `livo_command_center`, id=16), con
  timestamps de todo el ciclo del pedido — apta para calcular la ventana de 7 días. Se revisaron
  también `silver_sales_products`, `silver_pedidos_pdv`, `silver_pedidos_kpl` y `hubspot_contacts`
  (base `MKT`, id=15) buscando un identificador de cliente común a ambos lados. **No se encontró**:
  ninguna tabla de ventas/pedidos tiene email, teléfono, documento o `customer_id`, y no existe una
  tabla puente cliente↔pedido en el warehouse (se descartaron `clients`, acotada a MercadoLibre, y
  `kpl_clients_orders`, que es un log de sincronización ETL). Detalle completo, incluida la forma
  del query objetivo una vez que se identifique la columna correcta, en la sección 4 de
  `docs/fase3-analisis.md`. **Conclusión:** Iris no se puede implementar con el acceso actual sin
  que alguien del equipo de datos confirme el campo de vínculo cliente↔pedido; `simulateConversions.js`
  sigue siendo el mecanismo correcto mientras tanto.

**Nota de entorno:** igual que en sesiones anteriores, ningún archivo se pudo validar con
`npm run build`/`vercel dev` dentro de este puente (ver incidencia de Rollup/EACCES en la sección
5); todo se validó con `node --check` (para los `.js` puros) y revisión manual línea por línea
(para los `.jsx`). El usuario debe desplegar y confirmar visualmente los dos fixes.


_Nada movido a historial todavía._

### Sesión 2026-09-02 (env vars sin prefijo VITE_ — ADR 0005)

Al configurar `HS_PAT` en Vercel (sesión anterior, Fase 2), el usuario se encontró con un aviso de
Vercel: *"Remove the public framework prefix to keep this value private."* Ese mismo aviso también
le salió para `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (ahí es un falso positivo — esas dos
están pensadas para ser públicas), pero el usuario pidió explícitamente sacarles el prefijo `VITE_`
a las tres variables, no solo a la de HubSpot, entendiendo que eso rompía el mecanismo estándar de
Vite (se le avisó antes de proceder).

Entregado:

- `vite.config.js` — ahora usa la forma de función de `defineConfig` con `loadEnv(mode,
  process.cwd(), '')` para leer variables sin prefijo, y expone `SUPABASE_URL`/`SUPABASE_ANON_KEY`
  al cliente explícitamente vía `define` (mapea `import.meta.env.SUPABASE_URL` a su valor literal
  en build). Deliberadamente NO se usó `envPrefix: ''` (expondría automáticamente cualquier
  variable del proyecto al cliente, `HS_PAT` incluido) — cada variable pública se agrega a mano.
- `src/agents/demeter/supabaseClient.js` — lee `import.meta.env.SUPABASE_URL`/`SUPABASE_ANON_KEY`
  (sin `VITE_`).
- `.env.example`/`.env.local` — `VITE_SUPABASE_URL` -> `SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` -> `SUPABASE_ANON_KEY`. `HS_PAT` no cambió (ya estaba sin prefijo).
- **ADR 0005** documenta la decisión y dos consecuencias importantes: (1) cualquier variable nueva
  que el cliente necesite leer requiere agregar su `define` a mano en `vite.config.js` — ya no es
  automático como con el prefijo `VITE_`; (2) en Vercel, hay que actualizar el NOMBRE de las
  variables de Supabase a `SUPABASE_URL`/`SUPABASE_ANON_KEY` (sin `VITE_`) para que coincida con lo
  que el código ahora espera — si el usuario las deja con el nombre viejo en Vercel, el build en
  producción se conecta a Supabase con valores vacíos (mismo fallback silencioso ya documentado en
  `supabaseClient.js`: no rompe el build, pero sí la conexión).

**No se pudo verificar con un build real** por la misma incidencia de entorno de sesiones
anteriores (`npm install`/`npm run build` fallan dentro de este puente). Validado con `node --check`
+ revisión manual. El usuario debe confirmar con `npm run dev` (o `vercel dev`/deploy) en su propia
máquina que la app sigue conectando a Supabase después de este cambio, ANTES de asumir que
funciona.

### Sesión 2026-09-02 (Fase 2 — integración real con HubSpot, agente Hermes)

El usuario activó formalmente al agente **Hermes** (hasta ahora sin código) para reemplazar la
simulación de búsqueda de segmentos de la Fase 1 por una integración real con HubSpot, con una
regla de arquitectura explícita: por CORS y para proteger el Private App Token (`HS_PAT`), HubSpot
solo se llama desde una Serverless Function de Vercel, nunca desde el cliente React.

Entregado en esta sesión:

- **Hermes** (nuevo código, primera vez que este agente tiene implementación):
  `src/agents/hermes/services/hubspotService.js` — SOLO SERVIDOR, resuelve `listId` por nombre de
  lista, pagina `/memberships`, enriquece contactos vía `batch/read` en lotes de 100 (nunca un GET
  por contacto, instrucción explícita del usuario), con reintentos exponenciales ante 429/5xx
  respetando `Retry-After`.
- `api/hubspot/segment.js` (raíz del repo, no `src/agents/hermes/` — ver ADR 0004 sobre por qué):
  API Route de Vercel, único punto HTTP que el cliente puede llamar; valida el método/`listName` y
  delega en `hubspotService.js`.
- **Minerva**: `src/agents/minerva/utils/fetchSegmentFromHubSpot.js` (reemplaza el tamaño de
  muestra simulado por un `fetch` real a `/api/hubspot/segment`) y
  `src/agents/minerva/utils/simulateConversions.js` (lo que sigue simulado: el cruce de
  conversiones/compras, que depende de Metabase/Workingbits — tarea de Iris, no de esta sesión). Se
  eliminó `simulateSegmentLookup.js` (Fase 1) porque su responsabilidad quedó dividida entre esos
  dos archivos nuevos. `useCampaignCalculator.searchSegment()` ahora orquesta ambos: tamaño de
  muestra real + conversiones simuladas sobre ese tamaño real.
- **Hefesto**: `SegmentLookupField.jsx` actualizado (label, placeholder y texto de ayuda ya no
  dicen "simulado" para el tamaño de muestra, solo para conversiones; botón muestra "Buscando en
  HubSpot..." mientras carga).
- **ADR 0004**: Private App Token (no OAuth) + proxy serverless en `/api` (ubicación forzada por
  Vercel, única excepción documentada a "todo el código de un agente vive en
  `src/agents/<codename>/`").
- `.env.example` y `.env.local` actualizados con `HS_PAT` (sin prefijo `VITE_`, a propósito, para
  que Vite nunca lo incluya en el bundle de cliente). El usuario debe completar el valor real antes
  de probar.

**Importante para la próxima sesión que toque este código:** `npm run dev` (Vite) **no** sirve
`/api/*` — para probar la integración real localmente hace falta `vercel dev` (Vercel CLI) o
desplegar a Vercel. Esto no se pudo verificar en esta sesión: sigue sin resolverse la incidencia de
entorno de la sesión anterior (`npm install`/`npm run build` fallan dentro de este puente por un
bug de Rollup + permisos `EACCES`, ver sección 5) y `vercel dev` requeriría además la CLI de Vercel
y una cuenta autenticada, ninguna de las dos disponibles aquí. Todo el código nuevo se validó con
`node --check` y revisión manual, igual que en la sesión anterior.

### Sesión 2026-09-02 (pivote de Fase 1 — Calculadora Híbrida)

El usuario indicó que la integración directa con la API de Workingbits está bloqueada y pidió, como plan
de contingencia, una vista de **ingreso híbrido**: el usuario ingresa los datos de la campaña a mano y el
sistema simula la conexión (integración real futura) con HubSpot/Metabase para poblar tamaño de muestra y
conversiones de cada grupo. Adjuntó dos referencias visuales (layout del formulario/reporte, y el detalle
exacto de valores del dropdown de país) e instrucciones explícitas de flujo: el clic en "Calcular" nunca
debe escribir en Supabase; solo un botón separado de aprobación explícita ("Aprobar y Guardar en
Histórico") dispara el insert real.

Entregado en esta sesión (Hefesto + Minerva, según instrucción explícita del usuario):

- Minerva: `src/agents/minerva/constants/countries.js` (tarifas de SMS por país, fuente de verdad única del
  dropdown de país), `src/agents/minerva/utils/detectEventType.js` (regla reactiva: tipo de evento por
  palabras clave del nombre de campaña, default "Comercial"), `src/agents/minerva/utils/simulateSegmentLookup.js`
  (simulación determinística — hash del nombre de segmento + PRNG sembrado — de la futura integración
  HubSpot/Metabase; no toca red ni Supabase), `src/agents/minerva/utils/computeMetrics.js` (migración 1:1
  de `computeMetrics()` del prototipo HTML, función pura sin efectos secundarios), y
  `src/agents/minerva/hooks/useCampaignCalculator.js` (hook de orquestación: estado del formulario,
  búsqueda simulada, y separación dura entre `calculate()` — solo en memoria — y `approveAndSave()` — único
  punto que llama a `useFilteredCampaigns().save()`).
- Hefesto: `src/agents/hefesto/pages/CalculatorPage.jsx` (ya no es placeholder), y los componentes nuevos
  `src/agents/hefesto/components/calculator/CampaignForm.jsx`, `SegmentLookupField.jsx` (reutilizado por
  Grupo SMS y Grupo Control) y `CalculatorReport.jsx` (KPIs, tabla comparativa, detalle financiero y banner
  de ROI, replicando la referencia visual). Se agregó soporte de impresión (`window.print()` +
  reglas `@media print`/`.no-print` en `src/index.css`, aplicadas también a `Sidebar.jsx`/`Topbar.jsx`) para
  el botón "Imprimir / Exportar PDF".
- Fórmulas verificadas número a número contra la referencia visual adjunta (campaña
  `LV_CampañaRefuerzoJunio_250626`, ROI +5783.2%) antes de escribir el código — ver comentarios en
  `computeMetrics.js`.

**Incidencia de entorno detectada (no bloquea el código entregado, pendiente de que el usuario la resuelva
en su máquina):** `npm run build` falla hoy con `Cannot find module @rollup/rollup-linux-arm64-gnu` (bug
conocido de npm con dependencias opcionales de Rollup), y `npm install` para corregirlo falla a su vez con
`EACCES` al intentar renombrar archivos dentro de `node_modules/` (permisos de la carpeta sincronizada del
proyecto). Se validó la sintaxis de todo el código nuevo con `node --check` (los módulos `.js` puros) y
revisión manual línea por línea de los `.jsx` en su lugar, ya que `esbuild` tampoco pudo ejecutarse
(binario de arquitectura incorrecta). Sugerencia para el usuario: correr `rm -rf node_modules
package-lock.json && npm install` directamente en una terminal de su Mac (fuera de este puente), no dentro
de esta sesión.

### Sesión 2026-09-01 (Fase 1)

El usuario adjuntó un prototipo funcional (`calculadoraroisms010926.html`, con lógica de cálculo de ROI y una conexión a Supabase ya funcionando pero con credenciales hardcodeadas) y una referencia visual (`image_dfbb87.png`) y pidió arrancar la Fase 1 con Deméter, Minerva y Hefesto. Entregado en esta sesión:

- Deméter: `src/agents/demeter/schema/001_sms_campaigns.sql`, `supabaseClient.js` (credenciales movidas a variables de entorno), `services/smsCampaignsService.js`, `hooks/useSmsCampaigns.js`.
- Minerva: `src/agents/minerva/store/useCampaignStore.js` (Zustand), `hooks/useFilteredCampaigns.js`, `routes/AppRoutes.jsx` (rutas `/`, `/calculadora`, `/historico`).
- Hefesto: `tailwind.config.js` (tokens extraídos de la referencia visual), `AppLayout.jsx`, `Sidebar.jsx`, `Topbar.jsx`, `KpiCard.jsx`, `ChartCard.jsx`, y páginas por ruta (`DashboardPage`, `CalculatorPage`, `HistoryPage` — las dos últimas son placeholders).
- Se creó `ADR 0003` fijando React + Vite (no Next.js) por instrucción explícita del usuario.
- Se agregó el andamiaje de proyecto (`package.json`, `vite.config.js`, `index.html`, `.env.example`) necesario para que el código anterior compile como una app real.

Riesgo detectado y corregido por Deméter: el prototipo HTML tenía la URL y la anon key de Supabase hardcodeadas en el archivo; se documenta aquí porque esas credenciales quedaron expuestas en el HTML que el usuario compartió — recomendar rotarlas si ese HTML llegó a circular fuera de esta conversación.

### Sesión 2026-09-03 (pivote de Fase 2.1 — Ingesta de CSV de Workingbits y automatización de la Calculadora)

El usuario descartó la API de Workingbits (integración directa, dominio de Iris) y pidió operar
cargando el CSV que esa plataforma exporta (columnas `Communication Name`, `Send At`, `Text`, `To`,
`Status`), automatizando el Grupo SMS de la Calculadora a partir de esos datos. Ver ADR 0008 para el
detalle completo de la decisión.

Entregado en esta sesión:

- **Se crea el agente Éter** (no existía en SiMuS.io): `src/agents/eter/utils/parseWorkingbitsCsv.js`
  (agrupa filas por campaña, conteo estricto de `Delivered`, limpia teléfonos),
  `utils/cleanPhoneNumber.js` + `utils/countryDialCodes.js`. Ver `.claude/agents/eter.md` para la
  nota de adaptación de dominio (el Éter original de Proyecto Faro era un agente de almacenamiento
  de archivos, no de ingesta de CSV).
- **Deméter**: migración `003_sms_processed_campaigns.sql` (nueva tabla, RLS admin-only, depende de
  `is_admin()` de la migración 002) + `services/processedCampaignsService.js` +
  `hooks/useProcessedCampaigns.js`.
- **Hefesto**: página nueva `/upload` (`pages/UploadPage.jsx` + `components/upload/CsvUploadForm.jsx`,
  usa PapaParse — se agregó `papaparse` a `package.json`, pendiente `npm install` del usuario) y nav
  item en `Sidebar.jsx`. `CampaignForm.jsx`: "Nombre de la campaña" pasa de texto libre a `<select>`
  de campañas procesadas; Grupo SMS pierde `SegmentLookupField` y gana un campo `ReadOnly` de tamaño
  de muestra + botón "Buscar" que cruza directo contra Metabase. Grupo Control sin cambios.
- **Minerva**: `useCampaignCalculator.js` reescrito — `selectProcessedCampaign()` autocompleta
  fecha/mensaje/tipo de evento/muestra desde la campaña elegida; `searchSmsGroup()` reemplaza el
  `searchSegment('sms', ...)` viejo; `searchControlGroup()` es el `searchSegment('control', ...)` de
  antes, renombrado, sin cambios de lógica. Nuevos utils: `fetchConversionsByPhoneFromMetabase.js`,
  `parseCsvDate.js`.
- **Hermes**: `metabaseService.js` gana `fetchConversionsFromWarehouseByPhone()` — verificado contra
  el esquema real de Metabase en esta sesión (vía el conector `mcp__livo_metabase__*`, el mismo
  servidor MCP de producción) que `silver.sales` NO tiene columna de teléfono; el cruce por teléfono
  resuelve primero `customer_id` en `silver.customers` (por `phone` + `business_unit`, con
  `distinct`) y luego hace `join` contra `silver.sales` por ese id, para no duplicar ventas por
  fan-out. `api/metabase/conversions.js` ahora acepta `emails` O `phones` (nunca ambos) y
  dispatchea según cuál llegue.

**Riesgos documentados, no resueltos (ver ADR 0008 para el detalle):** el formato exacto de las
columnas `To` y `Send At` del CSV real de Workingbits no se pudo verificar contra un archivo de
ejemplo en esta sesión — `cleanPhoneNumber.js` y `parseCsvDate.js` son la mejor suposición
razonable, documentadas como heurísticas a validar con el primer CSV real que el usuario suba
(revisar la vista previa de `/upload` antes de confiar en el cruce de Metabase).

**Pendiente, a cargo del usuario:**
1. Correr `npm install` (se agregó la dependencia `papaparse`).
2. Aplicar la migración `003_sms_processed_campaigns.sql` en Supabase (requiere que la 002 ya esté
   aplicada, por la función `is_admin()`).
3. Subir un CSV real de Workingbits y revisar la vista previa de `/upload` (conteo de entregados y
   cantidad de teléfonos válidos) antes de usarlo en la Calculadora — ver riesgos arriba.
4. Deploy en Vercel + verificación end-to-end del flujo completo (subir CSV -> elegir campaña en la
   Calculadora -> Buscar -> Calcular -> Aprobar y Guardar), no se pudo probar desde este entorno
   (misma limitación de siempre, ver sección de `npm run dev`/`vercel dev` más arriba).

### Sesión 2026-09-03, tarde (corrección de Fase 2.2 — Restauración de HubSpot y manejo de duplicados)

El usuario corrigió dos huecos del pivote de Fase 2.1 (ver ADR 0009):

1. El Grupo SMS de la Calculadora había perdido por completo la búsqueda de HubSpot (Fase 2.1 cruzaba
   solo por teléfono). El campo "Nombre exacto de la lista en HubSpot" + botón "Buscar" vuelven para
   el Grupo SMS: `useCampaignCalculator.searchSmsGroup()` ahora busca esa lista en HubSpot Y cruza
   sus emails junto con los `telefonos_validos` del CSV contra Metabase en una sola llamada
   (`fetchConversionsForSmsGroup.js`, reemplaza a `fetchConversionsByPhoneFromMetabase.js`,
   eliminado). El tamaño de muestra del Grupo SMS sigue siendo `muestra_entregados` (ReadOnly) — no
   vuelve a depender de HubSpot.
2. `metabaseService.js` ganó `fetchConversionsFromWarehouseCombined()` (reemplaza a
   `fetchConversionsFromWarehouseByPhone()`, eliminada): resuelve `customer_id` de
   `silver.customers` por `(email OR phone)` en dos rondas de lotes deduplicadas en memoria, y
   agrega `silver.sales` por esos IDs. `/api/metabase/conversions` distingue el modo por la
   presencia de `phones` en el body.
3. Deméter: migración `004_processed_campaigns_unique_by_name.sql` corrige el `unique constraint` de
   `sms_processed_campaigns` — pasa de `(campaign_name, country_value)` a solo `campaign_name`
   (identificador único real de negocio = `Communication Name` del CSV). `processedCampaignsService.js`
   actualizado (`onConflict: 'campaign_name'`).

**Pendiente, a cargo del usuario (se suma a lo ya pendiente de la sesión anterior):**
- Aplicar también la migración `004_processed_campaigns_unique_by_name.sql` (después de la 003).
- Volver a probar el flujo del Grupo SMS end-to-end (CSV + HubSpot + Metabase) una vez desplegado —
  no se pudo probar desde este entorno.

### Sesión 2026-09-03, noche (fix — row_limit inválido en el cruce combinado del Grupo SMS)

El usuario probó el flujo real del Grupo SMS (HubSpot + CSV + Metabase) tras las correcciones de
Fase 2.2 y obtuvo el error `Invalid row_limit parameter: 800. Must be between 1 and 500.` desde el
servidor MCP de Metabase. Causa: `collectMatchedCustomerIds()` (agregada en ADR 0009) pedía UNA FILA
POR `customer_id` que matchea, y usaba el mismo `BATCH_SIZE` (800, pensado para el límite de
*payload* de las consultas agregadas) como `row_limit` — pero el servidor real limita `row_limit` a
un máximo de 500, distinto del límite de tamaño de payload.

Fix en `src/agents/hermes/services/metabaseService.js`: nueva constante `MAX_ROW_LIMIT = 500`
(documentada como el límite real, descubierto en producción) y `CUSTOMER_LOOKUP_BATCH_SIZE = 500`
(en vez de reusar `BATCH_SIZE`) para los lotes de email/teléfono de `collectMatchedCustomerIds` —
así el lote de entrada nunca puede producir más filas de las que el servidor deja pedir.
`runRowsQuery()` también aplica un `Math.min(rowLimit, MAX_ROW_LIMIT)` como red de seguridad,
independiente de qué le pase el llamador. Las consultas AGREGADAS (siempre devuelven 1 fila:
`fetchConversionsFromWarehouse`, `aggregateSalesForCustomerIds`) no se vieron afectadas — siguen
usando `BATCH_SIZE = 800` para el tamaño del `IN (...)`, que es un límite de payload distinto y no
choca con `row_limit`.

No se pudo volver a probar en vivo desde este entorno — pendiente que el usuario confirme que el
Grupo SMS ya cruza correctamente tras este fix.

### Sesión 2026-09-03, noche (2) — fix: "Respuesta del servidor MCP de Metabase sin cuerpo utilizable"

Tras el fix de `row_limit`, el usuario probó de nuevo el Grupo SMS y obtuvo este nuevo error, con
`res.ok` en 200 pero sin líneas `data:` en el body. Diagnóstico más probable (no confirmable desde
este entorno, sin acceso a las credenciales de producción): el cruce combinado hace varias llamadas
SECUENCIALES al MCP (una por lote de email, otra por lote de teléfono, más las de agregación de
ventas) — con un segmento de HubSpot y/o CSV grandes, la suma de esos round-trips puede acercarse al
límite de ejecución de la función serverless de Vercel (riesgo ya anotado en ADR 0006, "Riesgo a
vigilar"), cortando la conexión a mitad de la respuesta SSE.

Dos cambios en `metabaseService.js`:
1. Todas las funciones que batchean contra el MCP (`fetchConversionsFromWarehouse`,
   `collectMatchedCustomerIds`, `aggregateSalesForCustomerIds`) ahora disparan sus lotes EN
   PARALELO (`Promise.all`) en vez de secuencial — reduce el tiempo total de la función serverless
   cuando hay más de un lote.
2. `parseSseJsonRpc` ahora: (a) intenta parsear el body como JSON plano si no hay líneas `data:`
   (algunos gateways responden así en ciertos caminos de error), y (b) si de verdad no hay nada
   utilizable, el error incluye un fragmento del body crudo (hasta 300 caracteres) para poder
   diagnosticar la próxima vez sin adivinar.

**No se pudo reproducir ni confirmar la causa raíz desde este entorno** (sin las credenciales reales
de `METABASE_MCP_URL`/`METABASE_MCP_KEY` de producción). Si el error persiste tras este fix, el
fragmento de body que ahora se incluye en el mensaje de error es la pista clave a revisar — o
considerar si el plan de Vercel necesita más tiempo de ejecución por función (`maxDuration` en
`vercel.json`/`api/metabase/conversions.js`, disponible en planes pagos de Vercel).

### Sesión 2026-09-03, madrugada — rediseño de rendimiento: 502/Terminated en el cruce combinado del Grupo SMS

El usuario probó de nuevo el Grupo SMS tras los dos fixes anteriores (row_limit, SSE sin cuerpo) y
obtuvo `502 Bad Gateway` (nginx) o `Terminated`, con diagnóstico propio correcto: "la consulta esta
demorando demasiado con el tema de relacionar numeros y correos".

**Causa raíz**: el diseño de dos fases de ADR 0009 (`collectMatchedCustomerIds` +
`aggregateSalesForCustomerIds`) consultaba `silver.customers` DIRECTAMENTE por
`email IN (...)`/`phone IN (...)`, filtrando solo por `business_unit` — sin ventana de fecha.
`silver.customers` es una tabla enorme sin acotar (confirmado: BR solo ya tiene 621K+ filas en un
bucket de longitud de teléfono), así que la consulta nunca se reducía lo suficiente y agotaba el
tiempo del servidor MCP.

**Fix** (`src/agents/hermes/services/metabaseService.js`, ver ADR 0010 para el detalle completo):
nueva query única `buildCombinedSalesQuery` que arranca SIEMPRE desde `silver.sales` ya filtrada por
`business_unit` + ventana de 7 días + `status not ilike '%cancel%'`, y RECIÉN DESPUÉS hace `join`
contra `silver.customers` para el match de email/phone — nunca escanea `silver.customers` sin acotar.
Validada empíricamente contra datos reales vía `mcp__livo_metabase__execute` antes de escribir el
código (ver ADR 0010). `fetchConversionsFromWarehouseCombined` se simplificó a una sola fase, con
dedupe por `sale_id` (Map) en vez de por `customer_id` (Set). Se eliminaron
`collectMatchedCustomerIds`, `aggregateSalesForCustomerIds`, `CUSTOMER_ID_BATCH_SIZE` y
`CUSTOMER_LOOKUP_BATCH_SIZE` (código muerto tras el cambio). `node --check` confirma sintaxis válida.

**Riesgo aceptado**: al pedir filas de venta (no un agregado), la consulta queda sujeta a
`MAX_ROW_LIMIT = 500` por lote — si un solo lote matchea más de 500 ventas distintas en 7 días, se
trunca sin avisar. Improbable para volúmenes típicos de SMS, pero documentado como límite conocido.

**Riesgo de calidad de datos detectado (no resuelto)**: el mismo cliente real puede tener más de una
fila en `silver.customers` con distinto `business_unit` y el `phone` en formato inconsistente (con o
sin indicativo de país) — visto con datos reales. Pendiente de definir cómo normalizar.

**No se pudo probar end-to-end en producción desde este entorno** (sin credenciales reales de
Metabase) — solo se validó la consulta candidata contra datos reales vía el conector de desarrollo.
Pendiente que el usuario vuelva a probar el Grupo SMS y confirme que ya no aparece 502/Terminated.

### Sesión 2026-09-03, madrugada (2) — fix: "column reference \"created_at\" is ambiguous" en el cruce combinado

Tras el rediseño de rendimiento (ADR 0010), el usuario probó el Grupo SMS y obtuvo:
`SQL query execution failed: ERROR: column reference "created_at" is ambiguous`.

**Causa**: `sharedSalesWhere()` generaba `created_at`, `business_unit` y `status` SIN calificar con
alias de tabla. Eso era seguro mientras solo se usaba en `buildEmailSalesQuery` (una sola tabla,
`silver.sales`, sin `join`). El nuevo `buildCombinedSalesQuery` (ADR 0010) hace
`silver.sales s join silver.customers c` — y se confirmó vía `information_schema.columns` que
`silver.customers` TAMBIÉN tiene sus propias columnas `created_at`, `business_unit` y `status`. En
cuanto hay un `join`, Postgres exige calificar cualquier columna que exista en más de una tabla del
`FROM`, así que las cuatro condiciones de `sharedSalesWhere` quedaron ambiguas.

**Fix**: `sharedSalesWhere()` ahora acepta un parámetro `alias` (`'s'` por defecto) y prefija las
cuatro columnas con `${alias}.`. `buildEmailSalesQuery` la llama con `alias: ''` (sigue sin alias,
como antes — no hay ambigüedad posible con una sola tabla). `buildCombinedSalesQuery` la llama con
`alias: 's'` explícito (coincide con el alias de `silver.sales` en su `FROM`). Validado de nuevo
contra datos reales vía `mcp__livo_metabase__execute`: la consulta combinada (con `join`) y la de
solo-email (sin `join`) devuelven ambas el resultado esperado (`sale_id=3607600, revenue=4.35`),
`node --check` confirma sintaxis válida.

**Lección**: al agregar un `join` a una consulta que reutiliza cláusulas WHERE compartidas escritas
para una sola tabla, revisar si la tabla nueva tiene columnas con el mismo nombre — no asumirlo,
verificar contra `information_schema.columns` como se hizo aquí.

### Sesión 2026-09-03, madrugada (3) — aclaración de negocio: HubSpot y CSV NO se relacionan entre sí

El usuario preguntó cómo se relacionan la lista de HubSpot y el CSV de Workingbits, y señaló
correctamente que si no tienen nada en común, no hace falta pasar por `silver.customers` para todo.

**Respuesta de diseño**: NO hay ninguna relación técnica entre ambos — se corresponden solo por
convención humana (el usuario escribe a mano el nombre de la lista de HubSpot que sabe que
corresponde a la misma campaña del CSV). Por eso el cruce es un `OR` de dos identificadores
independientes, no un join entre HubSpot y el CSV.

De ahí surgió una inconsistencia real: la consulta combinada matcheaba el lado de email contra
`customers.email` (el email del PERFIL del cliente en el Data Warehouse) en vez de `sales.email` (el
email real usado en esa venta puntual — el mismo criterio que ya usa el Grupo Control). El usuario
confirmó, con `AskUserQuestion`, que el email debe matchear contra `silver.sales.email`, igual que el
Grupo Control.

**Fix en `buildCombinedSalesQuery`**: el lado de email ahora matchea `s.email` (columna propia de
`silver.sales`, sin depender de `silver.customers`); el lado de teléfono sigue necesitando
`silver.customers.phone` porque `silver.sales` no tiene columna de teléfono. El `join` pasó de
`join` a `left join` para no descartar ventas sin fila correspondiente en `silver.customers` — esas
ventas todavía pueden matchear por `s.email`, solo nunca matchean por teléfono. Validado de nuevo
contra datos reales vía `mcp__livo_metabase__execute` (mismo resultado esperado: `sale_id=3607600,
revenue=4.35`), `node --check` confirma sintaxis válida.

### Sesión 2026-09-03, madrugada (4) — ADR 0011: el Grupo SMS deja de relacionar silver.customers

El usuario reportó que, pese al rediseño de rendimiento anterior (ADR 0010), "seguimos teniendo
errores y tiempos de carga muy largos, no como antes", y pidió explícitamente: "que la consulta del
grupo sms funcione igual que grupo de control, no relacionar con silver.customer y asi podemos
agilizar un poco esta consulta".

**Decisión**: `fetchConversionsFromWarehouseCombined` (Grupo SMS) ahora delega DIRECTAMENTE en
`fetchConversionsFromWarehouse` (Grupo Control) — mismo cruce, solo por `email` contra
`silver.sales`, sin ningún `join`. Los `phones` del CSV de Éter se siguen recibiendo por
compatibilidad de firma pero se ignoran para este cruce (el tamaño de muestra del Grupo SMS,
`muestra_entregados`, NO cambia — solo deja de usarse teléfono para el cruce de conversiones).

**Código eliminado** (dead code tras el cambio): `buildCombinedSalesQuery`, `sanitizePhones`,
`PHONE_RE`, `runRowsQuery`, constante `CUSTOMERS_TABLE`. `node --check` confirma sintaxis válida.

**Trade-off aceptado explícitamente por el usuario**: un cliente que en `silver.customers` matchee
SOLO por teléfono (no por email de la lista de HubSpot) ya NO se cuenta como conversión del Grupo
SMS. Ver ADR 0011 para el detalle completo.

No se pudo probar en producción desde este entorno — el camino de código es idéntico al que ya usa
el Grupo Control desde ADR 0006 (sin SQL nuevo), así que no requiere nueva validación de query.
Pendiente que el usuario confirme que los tiempos de carga vuelven a ser normales.

### Sesión 2026-09-03, madrugada (5) — ADR 0012: REFINAMIENTO FASE 2.3 (querys + automatización de CSV)

Instrucción formal del usuario ("REFINAMIENTO FASE 2.3 — OPTIMIZACIÓN DE QUERYS Y AUTOMATIZACIÓN DE
CSV"), con tres frentes:

1. **Hermes**: `buildEmailSalesQuery` (usada por ambos grupos desde ADR 0011) se reestructuró como
   CTE explícita (filtrar fecha+business_unit+status en `sales_window`, recién después `email in
   (...)`). Se verificó con `EXPLAIN ANALYZE` contra datos reales que Postgres ya hacía esto solo
   gracias al índice `sales_created_at_index` (confirmado vía `pg_indexes`) — el refactor no cambia
   el plan de ejecución, pero deja la intención explícita en el SQL. Se evaluó bajar `ILIKE
   '%cancel%'` a un `NOT IN` exacto (pedido por el usuario) pero se descartó: hay docenas de
   variantes reales de "cancelado" en `silver.sales.status` (confirmado con
   `select distinct status, count(*)...`), y un `NOT IN` desactualizado contaría ventas canceladas
   como conversiones — un error de negocio peor que el rendimiento (que además `EXPLAIN ANALYZE`
   confirmó que no es el cuello de botella). Se evaluó subir `BATCH_SIZE` de 800 a 2000 (pedido) pero
   se mantuvo en 800 por el límite real de payload del MCP (~92.6-106.1KB, ya documentado) — 2000
   emails reales podrían reintroducir el 413. Todo documentado en el código y en ADR 0012.

2. **Éter/Deméter**: nuevo `src/agents/eter/utils/detectCountryFromCsv.js` — lee `Country Name` de
   la primera fila del CSV; para Brasil, inspecciona el prefijo de `Communication Name` (`NL_` →
   brasil-nl/BR, `LV_` → brasil-lv/LV); si es ambiguo o desconocido, `CsvUploadForm.jsx` muestra un
   modal de confirmación manual. El `<select>` de país en `/upload` se ELIMINÓ. `parseWorkingbitsCsv.js`
   ahora también extrae `Communication Start Date` (`fechaComunicacion`, distinta de `Send At`).
   Migración `005_processed_campaigns_communication_start_date.sql` agrega esa columna;
   `processedCampaignsService.js` actualizado.

3. **Hefesto/Minerva**: `useCampaignCalculator.selectProcessedCampaign` ahora autocompleta
   `sendDate` desde `communication_start_date` (fallback a `send_date` para campañas viejas) y
   `countryValue` resolviendo el país detectado por Éter — el flujo se invirtió: ya no se elige país
   antes de campaña, se listan todas las campañas y el país se resuelve después. `CampaignForm.jsx`:
   "Fecha de envío" y "País" pasan a ReadOnly (mismo patrón que "Tamaño de muestra real").

**No se pudo probar end-to-end en este entorno** (sin `npm run dev`/`vite build`, sin un CSV real de
Workingbits para confirmar los nombres exactos de `Country Name`/`Communication Start Date`).
Pendiente: aplicar migración 005 (después de 003 y 004), subir un CSV real y confirmar detección de
país/fecha, y reconfirmar que el Grupo SMS ya no da timeouts. Detalle completo en ADR 0012.

### Sesión 2026-09-03, tarde — ADR 0013: CORRECCIÓN FASE 2.4 (debugging de UI y parseo de datos)

QA del usuario contra la base de datos y la UI reales encontró tres fallos en lo implementado en Fase
2.3 (ADR 0012):

1. **Bug real de Brasil**: `detectCountryFromCsv.js` resolvía NL vs LV UNA SOLA VEZ por archivo
   (mirando la primera fila), asignando mal el país a campañas mezcladas en un mismo CSV — un archivo
   con campañas `NL_...` y `LV_...` terminaba con TODAS marcadas como la tienda de la primera fila.
   **Fix**: la resolución se movió a `parseWorkingbitsCsv.js`, POR GRUPO — cada campaña usa su propio
   `Communication Name` (`includes('NL_')`/`includes('LV_')`, según instrucción explícita). Grupos sin
   prefijo reconocible disparan un modal post-parseo pidiendo confirmar la tienda SOLO para esos
   grupos (`CsvUploadForm.jsx`).
2. **Bug real de fecha**: el CSV trae `DD/MM/YYYY HH:mm:ss` (confirmado por el usuario contra datos
   reales) — se guardaba crudo y `parseCsvDate.js` lo interpretaba con `new Date()`, que asume
   MM/DD/YYYY y daba `Invalid Date` o una fecha invertida. **Fix**: nuevo
   `src/agents/eter/utils/parseWorkingbitsDate.js` que asume DD/MM/YYYY explícitamente y normaliza a
   `YYYY-MM-DD` ANTES de guardar. `parseCsvDate.js` (Minerva) ahora también tiene ese mismo branch
   como capa defensiva, para que campañas ya guardadas con la fecha vieja mal formada también se vean
   bien sin re-subir el CSV.
3. **Reversión parcial de ADR 0012**: "País" volvió a ser un `<select>` editable en la Calculadora
   (el usuario lo elige ANTES de la campaña) y el dropdown de campañas volvió a filtrarse por país —
   `useCampaignCalculator.js`/`CampaignForm.jsx`. "Fecha de envío" SIGUE ReadOnly (eso no era el bug;
   con el fix de fecha ya se calcula bien).

Todo documentado con causa raíz en ADR 0013. `node --check` confirma sintaxis válida en los `.js`
tocados; los `.jsx` se revisaron manualmente (balance de llaves/paréntesis, sin checker disponible).

**Nota operativa de esta sesión**: el bridge al escritorio del usuario se cayó a mitad de la
corrección — todos los archivos se prepararon y validaron localmente (incluyendo pruebas de
`parseWorkingbitsDate`/`parseCsvDate` contra casos reales fuera del proyecto) y se entregaron también
como descarga en el chat antes de poder escribirlos, para no dejar al usuario sin nada mientras se
esperaba la reconexión. Al reconectar, se escribieron los 9 archivos + ADR 0013 sin cambios respecto
a lo ya validado.

**No se pudo probar end-to-end en este entorno** (sin `npm run dev`, sin un CSV real de Workingbits
con campañas NL_/LV_ mezcladas). Pendiente que el usuario: (1) vuelva a subir un CSV con campañas
mezcladas y confirme que cada una queda con su tienda correcta, (2) confirme que la fecha se
autocompleta visualmente, (3) confirme que el selector de País vuelve a filtrar el dropdown de
campañas como se espera.

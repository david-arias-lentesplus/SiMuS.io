# HANDOFF — SiMuS.io

> Bitácora técnica viva del proyecto. Mantenida por Apolo. Se actualiza al final de cada sesión de trabajo relevante, nunca retroactivamente. Lo obsoleto se mueve a la sección de Historial, no se borra.

Última actualización: 2026-09-02 (variables de entorno del cliente sin prefijo VITE_, ADR 0005).

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
- [ ] **Hallazgo de la auditoría de esta sesión, no resuelto:** la app no tiene autenticación (`src/agents/eleuthia/` solo tiene el README) — cualquiera con la URL puede leer el histórico completo y aprobar/guardar campañas. Ver `docs/fase3-analisis.md` sección 2, prioridad más alta para la siguiente fase.
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

0. **Iris**: definir e implementar el cruce real de conversiones (compras en los 7 días
   posteriores al envío) contra Metabase/Workingbits, reemplazando
   `src/agents/minerva/utils/simulateConversions.js` — mismo shape de retorno (number), mismo
   patrón que se usó para `fetchSegmentFromHubSpot.js` en la Fase 2. **Bloqueado (sesión
   2026-09-02):** se exploró `ss.silver_sales` y tablas relacionadas vía `livo_metabase` y no
   tienen ninguna columna de cliente (email/teléfono/documento/customer_id) que se pueda cruzar
   con `hubspot_contacts`. Se necesita que alguien del equipo de datos confirme qué columna o
   tabla puente vincula un pedido con la identidad del cliente antes de escribir el query real.
   Ver `docs/fase3-analisis.md` sección 4 para el detalle y la forma del query objetivo.
0. **Usuario**: configurar `HS_PAT` (Private App Token de HubSpot) en `.env.local` para probar
   localmente con `vercel dev`, y en Vercel Project Settings -> Environment Variables para
   producción. Ver `.env.example` y ADR 0004.

0. ~~**Hermes / Iris**: reemplazar la simulación de búsqueda de segmentos por una llamada real~~ — Hecho en sesión 2026-09-02 (Fase 2) para el tamaño de muestra (HubSpot, vía Hermes). **Sigue pendiente**: las *conversiones* siguen simuladas en `src/agents/minerva/utils/simulateConversions.js` porque dependen del cruce con Metabase/Workingbits — eso es Iris, no Hermes, y todavía no está integrado.

1. **Poseidón**: proponer (nunca ejecutar) los comandos para inicializar el repositorio Git, el proyecto en GitHub y el andamiaje inicial del código (framework a elegir junto con Hefesto/Minerva).
2. ~~**Hefesto + Minerva**: decidir el stack de frontend~~ — Hecho en sesión 2026-09-01 (Fase 1): React + Vite + Tailwind + Zustand, ver ADR 0003.
3. **Deméter**: el esquema de `sms_campaigns` (campañas ya calculadas) está creado; falta diseñar las tablas de clientes (Hermes/HubSpot) y eventos crudos de envío (Iris/Workingbits) cuando esos agentes definan su mecanismo de integración — sí requiere ADR por ser decisión de modelado relevante.
4. **Hermes**: definir el método de autenticación con HubSpot (OAuth app vs. Private App token).
5. **Iris**: definir el mecanismo de extracción de Workingbits (webhook vs. polling) antes de que cualquier dato real corra riesgo de expirar a los 90 días.
6. **Eleuthia**: definir la matriz de roles/permisos del equipo interno. **Urgente (hallazgo de
   la auditoría, sesión 2026-09-02):** hoy no existe ninguna autenticación — priorizar al menos
   un login mínimo (p. ej. Supabase Auth + allowlist de correos) antes de compartir la URL fuera
   del equipo. Ver `docs/fase3-analisis.md` sección 3.
7. **Apolo**: mantener este HANDOFF y el README actualizados a medida que se resuelvan los puntos anteriores.

## 5. Registro de errores / incidencias

_Sin incidencias registradas todavía. HADES documentará aquí cada rechazo relevante y su resolución; Apolo mantiene este registro._

| Fecha | Agente que reporta | Descripción | Resolución |
|---|---|---|---|
| 2026-09-02 | Usuario (reportado en producción, después del deploy) | La gráfica de "Actividad de Campañas" rompía toda la app en producción con `Uncaught Error: "bar" is not a registered controller.` — `ActivityChart.jsx` registraba escalas/elementos de Chart.js (`BarElement`, `LineElement`, etc.) pero no los *controllers* (`BarController`, `LineController`), que Chart.js v4 exige por separado. | Corregido: se agregó `BarController` y `LineController` al import y al `ChartJS.register(...)` en `src/agents/hefesto/components/ActivityChart.jsx`. No se pudo probar en un navegador real dentro de este puente (sin `npm run build`); el usuario debe confirmar tras el próximo deploy. |
| 2026-09-02 | Apolo (detectado durante verificación de la Calculadora Híbrida) | `npm run build` falla (`Cannot find module @rollup/rollup-linux-arm64-gnu`); `npm install` para corregirlo falla con `EACCES` dentro de esta sesión. | No bloqueó la entrega — código validado con `node --check` + revisión manual. Pendiente: usuario corre `rm -rf node_modules package-lock.json && npm install` en su propia terminal (ver Historial, sesión 2026-09-02). |
| 2026-09-02 | Apolo (Fase 2, integración HubSpot) | No se pudo probar `vercel dev` / la ruta `/api/hubspot/segment` end-to-end dentro de esta sesión (sin CLI de Vercel autenticada, y bloqueado además por la incidencia de `npm install` de la fila anterior). | No bloqueó la entrega — código validado con `node --check` + revisión manual. Pendiente: el usuario prueba con `vercel dev` (o despliega a Vercel) en su propia máquina, con `HS_PAT` configurado. |
| 2026-09-02 | Apolo (env vars sin prefijo VITE_) | No se pudo correr `npm run dev`/build para confirmar que la app sigue conectando a Supabase después de sacarle el prefijo VITE_ a SUPABASE_URL/SUPABASE_ANON_KEY (misma incidencia de entorno de sesiones anteriores). | No bloqueó la entrega — código validado con `node --check` + revisión manual del mecanismo `loadEnv`/`define` de Vite. Pendiente: el usuario confirma en su máquina Y renombra las variables en Vercel (ver tarea 0 de la sección 4). |

## 6. Decisiones de arquitectura relevantes

Ver `docs/adr/`. Resumen:

- **ADR 0001**: adopción del sistema de 9 agentes especializados (adaptado del patrón de Proyecto Faro).
- **ADR 0002**: Supabase como persistencia central para superar el límite de 90 días de retención de Workingbits.

## 7. Historial

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

# 0008 — Ingesta de CSV de Workingbits (Éter) y cruce por teléfono en el Grupo SMS

Fecha: 2026-09-03
Estado: Aceptado

## Contexto

La integración directa con la API de Workingbits (dominio de Iris, ver ADR 0001 / `.claude/agents/iris.md`)
quedó descartada por instrucción explícita del usuario ("PIVOTE FASE 2.1"). El sistema pasa a operar
cargando manualmente los archivos CSV que el usuario exporta desde la plataforma Workingbits, con
columnas `Communication Name`, `Send At`, `Text`, `To`, `Status`.

El usuario pidió automatizar el formulario de la Calculadora a partir de ese CSV, agrupado por
campaña (`Communication Name`), con tres reglas estrictas:

1. `muestra_entregados` es un conteo estricto de filas `Status === 'Delivered'` (nunca aproximado).
2. Los teléfonos del Grupo SMS (`telefonos_validos`) deben limpiarse del indicativo de país antes de
   cruzarlos contra el Data Warehouse.
3. El cruce final de conversiones/ventas del Grupo SMS debe hacerse contra `silver.customers` +
   `silver.sales` en Metabase, usando esos teléfonos — ya no un segmento de HubSpot.

## Decisión

1. **Se crea un agente nuevo, Éter**, para la lógica de parseo/agrupación/limpieza del CSV
   (`src/agents/eter/`). Éter no existía en SiMuS.io: en el patrón original de Proyecto Faro su
   dominio era almacenamiento de archivos (Google Drive); se reutiliza el codename para un dominio
   distinto — "agente dueño de una fuente de datos externa que exige transformación antes de tocar
   el resto del sistema" — documentado explícitamente en `.claude/agents/eter.md` como adaptación,
   no como continuidad del rol original.

2. **Nueva tabla `sms_processed_campaigns`** (Deméter, migración 003): almacena las campañas ya
   agrupadas por Éter (una fila = una campaña del CSV), DISTINTA de `sms_campaigns` (que guarda el
   reporte ya calculado y aprobado). RLS: solo admin (mismo criterio que `/upload` y `/calculadora`,
   ambas rutas admin-only).

3. **`/upload` (Hefesto, admin-only)**: el usuario elige el país y sube el CSV; PapaParse lo lee en
   el navegador, Éter lo agrupa, Deméter lo persiste. El país se elige del catálogo ESTÁTICO
   (`src/agents/minerva/constants/countries.js`), no de `countries_config` de Supabase, porque el
   mapeo de indicativo telefónico (`src/agents/eter/utils/countryDialCodes.js`) está definido para
   esos 6 `value` fijos — ver "Pendiente de definir" en `.claude/agents/eter.md` si algún día
   `/settings/countries` agrega un país nuevo.

4. **Calculadora (Minerva + Hefesto)**: "Nombre de la campaña" pasa de texto libre a un `<select>`
   poblado con `sms_processed_campaigns` del país elegido. Elegir una campaña autocompleta fecha,
   mensaje, tipo de evento y el tamaño de muestra REAL del Grupo SMS (`muestra_entregados`, ahora
   `ReadOnly` — ya no se puede editar a mano, para que nunca se desincronice del CSV real).

5. **Cruce del Grupo SMS por teléfono (Hermes)**: se verificó contra el esquema real de Metabase
   (sesión de este pivote) que `silver.sales` NO tiene columna de teléfono — solo `silver.customers`
   la tiene (`phone`, guardada SIN indicativo de país, confirmado con datos reales de `business_unit
   = 'CO'`). El cruce nuevo (`fetchConversionsFromWarehouseByPhone` en `metabaseService.js`) primero
   resuelve `customer_id` en `silver.customers` por `phone` + `business_unit` (con `distinct`, para
   no duplicar), y luego hace `join` contra `silver.sales` por ese `customer_id` — evita el fan-out
   que se produciría si el `join` fuera directo por teléfono repetido. Se reutiliza el mismo
   mecanismo de *batching* de 800 elementos por consulta que ya existía para el cruce por email (ver
   ADR 0006, "FIX 413 PAYLOAD TOO LARGE").

6. **`/api/metabase/conversions` acepta ahora `emails` O `phones`** (nunca ambos), dispatcheando a
   `fetchConversionsFromWarehouse` (email) o `fetchConversionsFromWarehouseByPhone` (teléfono) según
   cuál llegue. Esto evita crear una segunda ruta HTTP para algo que es la misma responsabilidad de
   Hermes (cruzar conversiones contra el warehouse), solo con una llave de cruce distinta.

7. **El Grupo Control NO cambia en este pivote**: sigue buscando un segmento de HubSpot por nombre y
   cruzando por email, exactamente como en la Fase 2/sesión de ajuste de Metabase (ADR 0006). El
   usuario solo pidió automatizar el Grupo SMS a partir del CSV; el Grupo Control necesita su propio
   segmento de comparación (no entregados de la misma campaña), que sigue viniendo de HubSpot.

## Consecuencias

- Requiere agregar la dependencia `papaparse` a `package.json` — el usuario debe correr `npm
  install` manualmente (regla del proyecto, ver memoria de sesión "sin comandos de npm/build").
- Requiere aplicar la migración `003_sms_processed_campaigns.sql` (depende de `public.is_admin()`,
  definida en la migración 002 — aplicar 002 antes si algún entorno no la tiene todavía).
- **Riesgo documentado, no resuelto**: el formato exacto de la columna `To` del CSV real de
  Workingbits (¿siempre con indicativo?, ¿con `+`?, ¿algún cero inicial?) no se pudo verificar
  contra un archivo de ejemplo real en esta sesión — la heurística de limpieza de teléfono
  (`cleanPhoneNumber.js`) es la mejor suposición razonable, documentada como tal. Debe validarse con
  el primer CSV real que el usuario suba, revisando `telefonos_validos` en la vista previa de
  `/upload` antes de confiar en el cruce de Metabase.
- **Riesgo documentado, no resuelto**: el formato de `Send At` tampoco se verificó contra un CSV
  real; `parseCsvDate.js` intenta ISO y `new Date(...)` como mejor esfuerzo y deja el campo vacío
  para completar a mano si no reconoce el formato — no se adivina una fecha incorrecta.
- Subir de nuevo un CSV con una campaña ya cargada (mismo `campaign_name` + país) REEMPLAZA esa fila
  en `sms_processed_campaigns` (upsert), no acumula duplicados — decisión de esta sesión, revisable
  si el usuario prefiere versionar en vez de reemplazar.

## Alternativas consideradas

- **Cruzar por teléfono directo contra `silver.sales`**: descartado porque esa tabla no tiene
  columna de teléfono (verificado contra el esquema real) — el cruce necesita pasar por
  `silver.customers` sí o sí.
- **Migrar también el Grupo Control al flujo de CSV**: descartado porque el CSV de Workingbits solo
  describe la campaña SMS enviada, no un grupo de control/comparación — esa sigue siendo información
  que solo HubSpot puede dar (una lista de contactos que NO recibieron el SMS).
- **Guardar el país de `sms_processed_campaigns` como uuid de `countries_config`**: descartado por
  ahora para no acoplar la ingesta de CSV a que el catálogo editable de países esté siempre
  sincronizado 1:1 con los `value` estáticos que necesita `cleanPhoneNumber.js` — ver punto 3 más
  arriba y el "Pendiente de definir" de `.claude/agents/eter.md`.

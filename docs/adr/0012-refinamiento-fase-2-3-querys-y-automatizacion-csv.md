# 0012 — Refinamiento Fase 2.3: estructura de query de Hermes y automatización del Centro de Carga

Fecha: 2026-09-03
Estado: Aceptado

## Contexto

Instrucción formal del usuario ("REFINAMIENTO FASE 2.3 — OPTIMIZACIÓN DE QUERYS Y AUTOMATIZACIÓN DE
CSV"), con tres frentes: (1) seguir atacando el riesgo de "terminated" en Metabase optimizando la
estructura SQL, (2) detectar el país automáticamente desde el CSV de Workingbits en `/upload`
(incluyendo el caso especial de las dos tiendas de Brasil), y (3) usar la fecha real de la
comunicación (`Communication Start Date`) para autocompletar y bloquear el campo de fecha en la
Calculadora.

## 1. Hermes — optimización de la consulta

### Regla de oro (filtrar fecha + business_unit antes del cruce)

Ya validado en ADR 0011 (el Grupo SMS cruza solo por email, sin `join` a `silver.customers`, igual
que el Grupo Control). Este refinamiento reestructura `buildEmailSalesQuery` como una CTE explícita:

```sql
with sales_window as (
  select sale_id, email, gmv_usd as revenue
  from silver.sales
  where business_unit = ... and created_at >= ... and created_at < ... and status not ilike '%cancel%'
)
select count(distinct sale_id) as conversions, coalesce(sum(revenue), 0) as total_sales
from sales_window
where email in (...)
```

Se verificó con `EXPLAIN ANALYZE` contra datos reales (`mcp__livo_metabase__execute`) que Postgres
YA aplicaba este orden por sí solo: `silver.sales` tiene un índice real sobre `created_at`
(`sales_created_at_index`, confirmado vía `pg_indexes`), así que el plan de ejecución hace un
`Bitmap Index Scan` sobre ese índice primero (reduciendo el universo a unos pocos miles de filas por
ventana de 7 días) y recién después aplica `business_unit`/`status`/`email` como `Filter` sobre esas
pocas filas — tiempos medidos de 30-55ms en escenarios reales (incluido `business_unit = 'BR'`, el de
mayor volumen). El refactor a CTE no cambia el plan de ejecución (confirmado, mismo `EXPLAIN`), pero
dado que la instrucción pide explícitamente esta estructura, se dejó escrita así para que ningún
cambio futuro dependa de que el optimizador la adivine.

### Batching: por qué se mantiene en 800, no 2000

La instrucción pedía trocear arrays de más de 2,000 registros. Se decidió MANTENER el tamaño de lote
en 800 (no subirlo a 2000): es el valor empíricamente seguro contra el límite REAL de payload del
servidor MCP de Metabase (~92.6KB-106.1KB, medido en una sesión anterior, "FIX 413 PAYLOAD TOO
LARGE"). 2000 emails reales (con dominios largos) pueden superar ese límite y reintroducir el error
413 ya resuelto. El comportamiento pedido — trocear arrays grandes en lotes y sumar los resultados en
Node.js — ya estaba implementado (`chunkArray` + `Promise.all`, desde ADR 0006) para cualquier tamaño
de array; solo el tamaño de lote real difiere del número pedido, documentado explícitamente en el
código (`metabaseService.js`, constante `BATCH_SIZE`).

### Por qué se mantiene `ilike '%cancel%'` en vez de `status not in (...)`

Se verificó contra los datos reales de `silver.sales` (`select distinct status, count(*) ... group by
status`) que existen DOCENAS de variantes de cancelación distintas según el país/plataforma de
origen: `canceled`, `CANCELADO`, `Cancelado`, `Pedido Cancelado-Pedido CANCELADO`, `Pedido
Cancelado-Cartão Negado`, `Pedido Cancelado-Boleto Expirado`, `Pedido Cancelado-Fraude`, entre otras.
Una lista exacta (`status not in ('canceled', 'CANCELADO')`) quedaría desactualizada apenas aparezca
una variante nueva, y el costo de ese error es CONTAR una venta cancelada como conversión real — un
error de negocio mucho más grave que una consulta un poco más lenta. Además, el mismo `EXPLAIN
ANALYZE` confirmó que el `ilike` NO es el cuello de botella real: se aplica sobre las pocas miles de
filas que ya sobrevivieron el filtro de `created_at` (indexado), no contra toda la tabla — su costo es
despreciable. Se mantiene `ilike`, documentado explícitamente con esta evidencia en el código.

## 2. Éter/Deméter — detección automática de país y fecha real de comunicación

### Detección de país (`src/agents/eter/utils/detectCountryFromCsv.js`, nuevo)

Al soltar el CSV en `/upload`, se lee la columna `Country Name` de la primera fila con valor. Para
"Colombia", "Chile", "Mexico"/"México", "Argentina" se asigna el `value` correspondiente
directamente. Para "Brasil"/"Brazil" (normalizado, sin acentos ni mayúsculas) se inspecciona el
prefijo de `Communication Name` de la primera fila con valor: `NL_` → `brasil-nl` (business_unit
`BR`), `LV_` → `brasil-lv` (business_unit `LV`) — mapeo ya existente en
`minerva/constants/countries.js`, sin cambios. Si el prefijo no es reconocible, o si el `Country
Name` no coincide con ningún país conocido, se muestra un modal (`CsvUploadForm.jsx`) pidiendo
confirmación manual antes de continuar — nunca se asigna un país adivinado sin que el usuario lo
confirme. El caso "país desconocido" (más allá del caso Brasil explícitamente pedido) es una
extensión defensiva agregada por consistencia, no una instrucción literal del usuario.

El `<select>` manual de país en `/upload` se ELIMINA por completo.

**Riesgo documentado (no verificado contra un CSV real)**: el formato exacto de la columna `Country
Name` (¿siempre en español?, ¿con o sin acentos?, ¿alguna vez un código ISO en vez del nombre?) no se
pudo confirmar contra un archivo real de Workingbits en esta sesión — mismo riesgo ya documentado en
`.claude/agents/eter.md` para `cleanPhoneNumber()`. La normalización cubre las variantes más
probables; cualquier otra cae al modal de confirmación manual en vez de fallar en silencio.

### Fecha real de comunicación (`Communication Start Date`)

`parseWorkingbitsCsv.js` ahora también extrae el PRIMER valor de `Communication Start Date` por
grupo (`fechaComunicacion`), igual criterio que ya usa para `fecha`/`Send At` — son columnas
DISTINTAS: `Send At` puede variar fila a fila si el envío se hizo en tandas, mientras que
`Communication Start Date` es la fecha real de inicio de la comunicación completa.

Migración `005_processed_campaigns_communication_start_date.sql`: agrega la columna
`communication_start_date` (texto, igual criterio que `send_date`) a `sms_processed_campaigns`.
`processedCampaignsService.js` actualizado para persistirla.

## 3. Hefesto/Minerva — autocompletado y bloqueo de Fecha y País en la Calculadora

`useCampaignCalculator.selectProcessedCampaign` ahora, al elegir una campaña:
- Autocompleta `sendDate` desde `communication_start_date` (con `send_date` como fallback SOLO para
  campañas cargadas antes de la migración 005, que no tienen el campo nuevo).
- Autocompleta `countryValue` resolviendo el `country_value` guardado por Éter (detección automática)
  contra el catálogo de países activo, vía `resolveCountryForProcessedCampaign` (puentea por
  `businessUnit`, mismo mecanismo que ya usaba el filtro de campañas por país, ahora invertido).

**Cambio de flujo importante**: antes el usuario elegía el País PRIMERO (filtrando qué campañas se
ofrecían); ahora se listan TODAS las campañas procesadas sin filtrar por país, y el País se resuelve
DESPUÉS a partir de la campaña elegida — porque el país ya no es una decisión del usuario en este
punto, es un dato que Éter ya detectó al subir el CSV.

`CampaignForm.jsx`: los campos "Fecha de envío" y "País" pasan de `<input>`/`<select>` editables a
campos ReadOnly (mismo patrón visual que "Tamaño de muestra real (Entregados)", ya ReadOnly desde
ADR 0008) — el usuario ya no puede desalinear a mano lo que ve en el formulario de lo que
efectivamente se usa para consultar Metabase.

## Estado de verificación

Las consultas SQL de Hermes se validaron contra datos reales vía `mcp__livo_metabase__execute`
(`EXPLAIN ANALYZE`, distribución real de `status`, índices reales vía `pg_indexes`) antes de escribir
el código. Los cambios de Éter/Deméter/Hefesto/Minerva (detección de país, fecha de comunicación,
UI ReadOnly) NO se pudieron probar end-to-end en este entorno — no hay forma de correr
`npm run dev`/`vite build` aquí (limitación ya documentada del proyecto) ni un CSV real de Workingbits
para confirmar los nombres exactos de columna (`Country Name`, `Communication Start Date`). Pendiente
que el usuario: (1) aplique la migración 005 (después de 003 y 004), (2) suba un CSV real y confirme
que el país y la fecha de comunicación se detectan/leen correctamente, (3) confirme que el Grupo SMS
ya no da timeouts.

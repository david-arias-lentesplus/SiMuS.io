# ADR 0006: Cruce real de conversiones vía Metabase, implementado en Hermes

- **Fecha:** 2026-09-02
- **Estado:** Aceptada (instrucción explícita del usuario)

## Contexto

`simulateConversions.js` (Minerva) simulaba el cruce "clientes de un segmento de HubSpot que
compraron en los 7 días posteriores al envío del SMS" desde la Fase 1. En la sesión de auditoría
de esta misma fecha (ver `docs/fase3-analisis.md`) se había explorado el Data Warehouse vía
Metabase y no se encontró ninguna columna de email/cliente en las tablas de ventas revisadas
(`ss.silver_sales`, `silver_pedidos_pdv`, `silver_pedidos_kpl` en la base `livo_command_center`).

El usuario, en un mensaje posterior ("AJUSTE DE INTEGRACIÓN METABASE"), corrigió ese hallazgo:
verificó que la tabla **`silver.sales`** (schema `silver`, no `ss` — vive en la base **DWH**, un
proyecto de Metabase distinto al que se había explorado antes) sí tiene una columna `email`
directamente utilizable como llave de cruce, y dio la especificación exacta de los 4 filtros de
negocio a aplicar. Verificado en esta sesión contra el esquema real: `silver.sales` tiene
`email`, `business_unit`, `status`, `sale_id`, `created_at` y `total` con los tipos esperados.

## Decisión

1. **La consulta se implementa en Hermes** (`src/agents/hermes/services/metabaseService.js` +
   `api/metabase/conversions.js`), no en Iris, por instrucción explícita y literal del usuario
   ("Instrucciones para Hermes (Backend / API Route de Metabase)"). Esto es una excepción puntual
   a la regla de dominio original (`.claude/agents/iris.md` dice que Metabase/Workingbits es
   dominio de Iris) — se documenta aquí para que ninguna sesión futura la revierta por asumir que
   fue un error. Iris sigue siendo la única puerta de entrada al *envío* de SMS vía Workingbits;
   eso no cambió.
2. **Autenticación y protocolo — corregido tras pruebas reales de conexión:** la primera versión
   de esta ADR asumía que se hablaba con la API REST de Metabase directamente
   (`POST /api/dataset`, header `x-api-key`). El usuario encontró la credencial real de un
   proyecto anterior (`METABASE_MCP_URL`/`METABASE_MCP_KEY`) y, al probarla contra el endpoint
   (`https://mcp.livocompany.com/metabase/mcp`), resultó ser un **servidor MCP** (`metabase-mcp`,
   el mismo conector de solo lectura que este asistente usa en desarrollo como
   `mcp__livo_metabase__*`), no la API REST de Metabase. Confirmado con pruebas reales (`curl`)
   antes de reescribir el código:
   - Protocolo: JSON-RPC 2.0 sobre HTTP POST, respuesta en formato SSE
     (`Content-Type: text/event-stream`, un bloque `event: message` / `data: {...}` por request).
     El header `Accept` debe incluir literalmente `application/json, text/event-stream` — si falta
     alguno de los dos, el servidor responde `406 Not Acceptable`.
   - Autenticación: query param `?api_key=...` en la URL. Se probaron `Authorization: Bearer`,
     `x-api-key` y `apikey` como headers y los tres devolvieron `401 Unauthorized` contra este
     servidor — solo el query param funciona.
   - Se llama a la tool `execute` (la misma que `mcp__livo_metabase__execute` en este entorno) vía
     `tools/call`, con `{database_id, query, row_limit}` como argumentos — mismo contrato SQL que
     ya se había diseñado, solo cambió el transporte.
   - **Prueba end-to-end real** (no solo de conectividad): se ejecutó la consulta completa del
     servicio con un email real tomado de `silver.sales` (`mabalejo89@gmail.com`, venta conocida
     de `total=16278` el 2026-08-01 en `CO`) y el resultado devuelto fue exactamente
     `{conversions: 1, total_sales: 16278}` — confirma que el query, el filtro y el parseo de la
     respuesta MCP funcionan correctamente contra datos reales, no solo que la conexión responde.
3. **Construcción del SQL:** en vez de usar "field filter" template-tags de Metabase para el
   `IN (...)` de emails (mecanismo pensado para preguntas guardadas con parámetros ya mapeados a
   un campo específico, incómodo de armar dinámicamente vía API), se arma el SQL directamente en
   el servidor con escapado manual (`'` -> `''`) y validación estricta antes de interpolar:
   - Emails: se descarta cualquier valor que no matchee un regex simple de email.
   - `business_unit`: solo se acepta un valor de una whitelist cerrada (`CO`, `AR`, `CL`, `MX`,
     `BR`, `LV` — los mismos 6 países del dropdown de la Calculadora).
   - `sendDate`: solo se acepta formato `YYYY-MM-DD` (regex), y las fechas de la ventana de 7 días
     se calculan en JS antes de interpolar, nunca con aritmética de fechas del lado del SQL.
   - `status`: la exclusión de cancelaciones es un `NOT ILIKE '%cancel%'` fijo en el código, no un
     valor que llegue del cliente.
   Es un SQL armado a mano, pero con superficie de inyección cerrada: ningún valor llega de fuera
   sin pasar por una validación de forma estricta primero.
4. **Columna de fecha de compra:** `created_at` (timestamp de creación del pedido), confirmada
   explícitamente por el usuario tras entregada la primera versión de esta integración — no una
   suposición del código.
5. **Mapeo de `business_unit`:** dado literalmente por el usuario (Brasil NL -> `BR`, Brasil LV ->
   `LV`). Se verificó que `silver.sales.business_unit` sí tiene ambos códigos como valores reales,
   pero también existe un código `NL` separado en la misma columna — el usuario confirmó que
   "Brasil NL" debe mapear a `BR` y no a `NL` a pesar de esa aparente coincidencia de nombre. Si
   una sesión futura ve datos que contradicen esto, hay que volver a confirmar con el usuario antes
   de "corregir" el mapeo.
6. **`smsS`/`ctrlS` ("Total ventas") ya no son solo campos manuales**: `searchSegment()` ahora
   también completa esos campos con `totalSales` de la respuesta real de Metabase (antes solo
   completaba tamaño de muestra y conversiones; el revenue se dejaba en manual porque no existía
   ninguna fuente real para completarlo). El campo sigue siendo editable por si el usuario necesita
   corregirlo a mano.
7. **Columna de revenue: `gmv_usd`, no `total`** (corregido el mismo día, último ajuste antes de
   desplegar). `silver.sales.total` viene en la moneda local de cada `business_unit` — sumarlo
   entre países distintos no tendría sentido, y el label del campo en la Calculadora
   (`CampaignForm.jsx`, "Total ventas SMS (USD)") ya decía "USD" aunque el dato real fuera moneda
   local. `gmv_usd` es el mismo revenue ya convertido a dólares, así que además de ser lo que pidió
   el usuario, corrige esa inconsistencia de unidades sin tocar la UI (la etiqueta "(USD)" ahora sí
   describe el dato que muestra). Verificado con la misma venta real usada para probar la
   integración (`mabalejo89@gmail.com`, 2026-08-01, `total=16278` moneda local -> `gmv_usd=4.35`).

## Consecuencias

- `simulateConversions.js` se eliminó — ya no queda ninguna simulación en el flujo de la
  Calculadora (Fase 1, 2 y este ajuste cierran el círculo: tamaño de muestra, conversiones y
  ventas son las tres reales).
- Nueva dependencia de infraestructura: `METABASE_MCP_URL`, `METABASE_MCP_KEY` y
  `METABASE_DATABASE_ID` deben configurarse en Vercel — ver `.env.example`. Los tres valores reales
  ya quedaron cargados en `.env.local` (el usuario los encontró de un proyecto anterior y se
  probaron con éxito en esta sesión) — falta que el usuario los copie a Vercel Project Settings ->
  Environment Variables.
- Riesgo a vigilar: `METABASE_MCP_KEY` es una credencial de un **proyecto anterior**, no generada
  específicamente para SiMuS.io. Si ese proyecto anterior la rota o la revoca en algún momento,
  esta integración se rompe sin aviso previo — vale la pena que el usuario confirme si conviene
  generar una API key nueva y dedicada a SiMuS.io en el servidor MCP, en vez de depender de una
  credencial compartida con otro proyecto.
- El servidor MCP fue probado end-to-end en esta sesión con datos reales (ver punto 2 más arriba),
  pero eso fue una llamada directa al servidor MCP desde este entorno de desarrollo — la
  integración completa (Calculadora -> `/api/metabase/conversions` -> `metabaseService.js` ->
  servidor MCP) sigue sin probarse dentro de un despliegue real de Vercel (sin `vercel dev` en
  este puente, ver incidencia de entorno recurrente en `HANDOFF.md`); el usuario la prueba
  directamente en Vercel.

## Addendum — fix de 413 Payload Too Large (mismo día, sesión de "buscar grupo falla")

Tras el punto 7 anterior, el usuario probó el flujo completo en Vercel y reportó, al buscar un
grupo con un segmento grande de HubSpot: `Servidor MCP de Metabase respondió 413: ...
PayloadTooLargeError: request entity too large ... at readStream
(.../supergateway/node_modules/body-parser/node_modules/raw-body/index.js:163:17)` — sin devolver
datos.

**Causa:** la consulta original interpolaba TODOS los emails del segmento en un único
`email IN (...)`. Para segmentos con miles de contactos, el body del POST JSON-RPC superaba el
límite de tamaño que el body-parser del servidor MCP acepta.

**Medición del límite real:** se armaron requests sintéticos (mismo shape exacto que
`callMcpTool`/`buildQuery` producen) con 500/1000/2000/3000/3500/4000/5000 emails y se probaron
contra el servidor MCP en vivo:

| emails | bytes del body | resultado |
|---|---|---|
| 500 | 12,578 | 200 |
| 1000 | 25,079 | 200 |
| 2000 | 52,079 | 200 |
| 3000 | 79,079 | 200 |
| 3500 | 92,579 | 200 |
| 4000 | 106,079 | 413 |
| 5000 | 133,079 | 413 |

El límite real cae entre 92.6KB y 106.1KB — muy probablemente el default de 100KB de `raw-body`
(la librería que aparece en el stack trace del error).

**Fix implementado en `src/agents/hermes/services/metabaseService.js`:** se agregó
`EMAIL_BATCH_SIZE = 800` (margen de ~4x bajo el límite medido, para absorber que emails reales
pueden ser más largos que los sintéticos `userN@exampleN.com` usados en la prueba). La lista de
emails sanitizada se parte en lotes de ese tamaño (`chunkArray`) y `fetchConversionsFromWarehouse`
ahora ejecuta una llamada `execute` por lote, secuencialmente (no en paralelo, para no saturar el
servidor MCP), reutilizando los mismos filtros de `business_unit`/`sendDate`/`status` en cada
lote, y suma `conversions`/`total_sales` de todos los lotes antes de devolver el resultado. Esto es
seguro porque `email` es una clave de partición disjunta: ningún email puede caer en dos lotes a la
vez, así que no hay riesgo de doble conteo de ventas al sumar across lotes.

`api/metabase/conversions.js` y el resto de la cadena (`fetchConversionsFromMetabase.js`,
`useCampaignCalculator.js`) no cambiaron — el batching es interno a `metabaseService.js` y
transparente para quien lo llama.

**Validado con:** `node --check` sobre el archivo modificado (sintaxis OK) y las mediciones de
tamaño de payload contra el servidor MCP real de la tabla arriba. No se pudo probar el flujo
completo end-to-end en un navegador real contra un segmento grande de HubSpot desde este entorno
de desarrollo (misma limitación de siempre: sin `vercel dev` en este puente) — el usuario debe
confirmar en Vercel que el botón "Buscar" ya no falla con 413 para grupos grandes.

**Pendiente a considerar (no bloqueante, no pedido explícitamente):** con segmentos muy grandes
(por ejemplo, >8000-10000 emails => 10+ lotes secuenciales), el tiempo total de la función
serverless podría acercarse al límite de ejecución de Vercel (10s en el plan Hobby). Si esto llega
a pasar en producción, las opciones son: aumentar el plan/timeout de la función, paralelizar los
lotes con un límite de concurrencia, o aumentar `EMAIL_BATCH_SIZE` una vez que se confirme con más
certeza dónde está el límite real del servidor MCP (entre 92.6KB y 106.1KB, sin acotar más para no
gastar más llamadas de prueba de las necesarias).

## Addendum — corrección de la ventana de atribución: 7 días en total, no sendDate+7 (mismo día)

El usuario reportó que la ventana de atribución estaba trayendo datos de **8 días**: el código
calculaba el límite superior exclusivo como `sendDate + 8 días` (`addDaysISO(sendDate, 8)`), lo
que en la práctica cubre `sendDate` (día 0) hasta `sendDate + 7` (día 7) — 8 días calendario en
total, uno de más.

**Corrección:** la ventana debe ser de **7 días en total, contando el día del envío** (día 0 al
día 6). El límite superior exclusivo pasó de `addDaysISO(sendDate, 8)` a `addDaysISO(sendDate, 7)`
en `buildQuery()` (`src/agents/hermes/services/metabaseService.js`). El resto del query no cambió:
sigue siendo `created_at >= sendDate AND created_at < <límite>` para no depender de la resolución
de tiempo de `created_at` (timestamp sin zona horaria).

Ejemplo concreto: para `sendDate = '2026-08-01'`, antes el rango cubría `2026-08-01` a
`2026-08-08` (8 días); ahora cubre `2026-08-01` a `2026-08-07` (7 días: 01, 02, 03, 04, 05, 06,
07).

**Validado con:** `node --check` sobre el archivo modificado (sintaxis OK). No se pudo re-probar
contra el servidor MCP en vivo con una venta real conocida en esta ventana específica desde este
entorno de desarrollo — el cambio es una corrección aritmética de un solo valor (7 en vez de 8) en
una función ya probada end-to-end en el ajuste anterior, así que el riesgo de regresión es bajo,
pero el usuario debe confirmar en Vercel que los números de conversiones/ventas bajan de forma
consistente con una ventana un día más corta.

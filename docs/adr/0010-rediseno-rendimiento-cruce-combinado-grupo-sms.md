# 0010 — Rediseño de rendimiento del cruce combinado del Grupo SMS

Fecha: 2026-09-03
Estado: Aceptado (corrige el diseño de consulta de ADR 0009, sin revertir su decisión de negocio)

## Contexto

Tras los dos fixes de la sesión anterior (`row_limit` inválido, y "Respuesta del servidor MCP de
Metabase sin cuerpo utilizable"), el usuario volvió a probar el flujo real del Grupo SMS y obtuvo un
error más severo:

```
error al intentar grupo sms — Servidor MCP de Metabase respondió 502:
<html><head><title>502 Bad Gateway</title></head><body>
<center><h1>502 Bad Gateway</h1></center><hr><center>nginx/1.24.0 (Ubuntu)</center>
</body></html>
```

— o, en otros intentos, `Terminated`. El usuario diagnosticó correctamente la causa: "veo que la
consulta esta demorando demasiado con el tema de relacionar numeros y correos — debemos encontrar
una mejor forma para hacer esto y que la consulta demore mucho menos".

A diferencia de los dos fixes anteriores (un parámetro inválido, un parseo de respuesta frágil), este
error indica que la consulta SQL en sí (o el pipeline completo) se queda sin tiempo o es matada por
el proceso — no un problema de protocolo.

## Diagnóstico

El diseño de dos fases de ADR 0009 (`collectMatchedCustomerIds` + `aggregateSalesForCustomerIds`)
resolvía primero los `customer_id` consultando **`silver.customers` directamente** por
`email IN (...)` o `phone IN (...)`, filtrando solo por `business_unit` — sin ninguna ventana de
fecha. `silver.customers` es una tabla enorme y sin acotar: en esta misma sesión se había confirmado
empíricamente (vía `mcp__livo_metabase__execute`, el mismo servidor MCP de producción) que solo el
`business_unit = 'BR'` tiene 621K+ filas en un único bucket de longitud de teléfono. Un filtro que
solo acota por país nunca reduce lo suficiente el conjunto a escanear, y la consulta terminaba
agotando el tiempo del servidor MCP (502) o siendo matada (Terminated).

## Decisión

Invertir el orden del `join`: la consulta combinada arranca **siempre desde `silver.sales`**, ya
filtrada por `business_unit` + ventana de `created_at` (7 días de atribución) +
`status not ilike '%cancel%'` — un conjunto naturalmente chico y acotado — y **recién después** hace
`join` contra `silver.customers` para revisar el match de `email`/`phone`. Esto evita por completo el
escaneo sin acotar de la tabla de clientes, aprovechando que `silver.sales` ya es chica por
construcción para cualquier país + ventana de 7 días.

Nueva query única (`buildCombinedSalesQuery`, en `src/agents/hermes/services/metabaseService.js`):

```sql
select s.sale_id as sale_id, s.gmv_usd as revenue
from silver.sales s
join silver.customers c on c.customer_id = s.customer_id
where <business_unit + ventana de 7 días + status not ilike '%cancel%'>
  and (c.email in (...) or c.phone in (...))
```

Validada empíricamente ANTES de escribir el código, vía `mcp__livo_metabase__execute` (mismo servidor
MCP de producción que usa Hermes):

```sql
select s.sale_id, s.gmv_usd as revenue
from silver.sales s
join silver.customers c on c.customer_id = s.customer_id
where s.business_unit = 'CO'
  and s.created_at >= '2026-08-01'::timestamp
  and s.created_at < '2026-08-08'::timestamp
  and s.status not ilike '%cancel%'
  and (c.email in ('mabalejo89@gmail.com') or c.phone in ('3183628705'))
```

→ devolvió exactamente 1 fila (`sale_id=3607600, revenue=4.35`), excluyendo correctamente una venta
cancelada del mismo cliente con timestamp muy cercano (`sale_id=3607597, status='canceled'`).

Esto reemplaza el diseño de dos fases por uno solo:

- `collectMatchedCustomerIds` y `aggregateSalesForCustomerIds` (ADR 0009) se **eliminan**.
- `fetchConversionsFromWarehouseCombined` ahora arma una o varias consultas
  `buildCombinedSalesQuery` (una sola si emails+phones caben en un lote de `BATCH_SIZE`; si no,
  trocea cada lista por separado para no armar un `IN` gigante) y las dispara en paralelo
  (`Promise.all`, ya establecido en el fix anterior).
- Deduplicación: antes era por `customer_id` (Set); ahora es por `sale_id` (Map en memoria), porque
  la consulta ya devuelve filas de venta directamente — si el mismo cliente matchea por email y por
  teléfono en lotes distintos, la misma venta puede aparecer repetida entre lotes, y el `Map` la
  cuenta una sola vez.
- `CUSTOMER_ID_BATCH_SIZE` y `CUSTOMER_LOOKUP_BATCH_SIZE` (constantes de ADR 0009/fix de
  `row_limit`) quedaron sin uso y se eliminaron.

## Riesgo aceptado (documentado, no bloqueante)

A diferencia de una consulta agregada (siempre 1 fila, nunca choca con `row_limit`), esta consulta
pide filas individuales de venta, sujeta a `MAX_ROW_LIMIT = 500` por lote (el límite real del
servidor, descubierto en el fix anterior). Si un solo lote matchea más de 500 ventas distintas en la
ventana de 7 días, el resultado se trunca sin avisar. Se considera improbable para volúmenes típicos
de conversión de una campaña de SMS en 7 días, pero queda como limitación conocida a vigilar si el
volumen de conversiones por búsqueda crece mucho.

## Riesgo de calidad de datos (detectado, NO resuelto por este ADR)

Durante la validación se encontró que el mismo cliente real (`mabalejo89@gmail.com`) tiene DOS filas
en `silver.customers` con distinto `business_unit` (AR y CO) y con el `phone` en formato
INCONSISTENTE — una CON indicativo de país (`"573183628705"`) y otra SIN (`"3183628705"`). Esto puede
afectar la tasa de match del Grupo SMS de forma independiente al fix de rendimiento de este ADR.
Queda documentado como pendiente de definir (ver `.claude/agents/eter.md`), no se aborda aquí.

## Estado de verificación

No se pudo probar este rediseño end-to-end en producción desde este entorno de desarrollo (sin
acceso a las credenciales reales de `METABASE_MCP_URL`/`METABASE_MCP_KEY`). Se validó únicamente la
consulta candidata contra datos reales de producción vía el conector de desarrollo
(`mcp__livo_metabase__execute`, confirmado en sesiones anteriores como el mismo servidor MCP
subyacente). Pendiente que el usuario vuelva a probar el flujo del Grupo SMS y confirme que ya no
aparece `502`/`Terminated`, y que los números de conversión resultantes tengan sentido.

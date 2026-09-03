# 0009 — Restauración de HubSpot en el Grupo SMS y upsert por Communication Name

Fecha: 2026-09-03
Estado: Aceptado (corrige ADR 0008)

## Contexto

El ADR 0008 (pivote de Fase 2.1) reemplazó por completo el flujo del Grupo SMS: en vez de buscar un
segmento de HubSpot, cruzaba directamente los `telefonos_validos` del CSV de Workingbits contra
Metabase. El usuario detectó dos huecos en ese diseño:

1. El CSV de Workingbits solo trae teléfonos. Para el mejor cruce posible contra Metabase también
   hacen falta los EMAILS de esa misma audiencia — que solo HubSpot puede dar — y HubSpot sigue
   siendo, además, la única fuente del Grupo de Control (contactos que NO recibieron el SMS, que por
   definición no están en el CSV de envíos).
2. El `unique constraint` de `sms_processed_campaigns` (migración 003) usaba
   `(campaign_name, country_value)`. La regla de negocio real es que el identificador único de una
   campaña procesada es solo el `Communication Name` del CSV.

## Decisión

1. **El campo "Nombre exacto de la lista en HubSpot" + botón "Buscar" vuelven para el Grupo SMS**
   (`SegmentLookupField`, ahora con un prop `disabled` nuevo para bloquearlo hasta elegir una
   campaña del CSV). El Grupo Control ya lo tenía sin cambios desde ADR 0008.

2. **`useCampaignCalculator.searchSmsGroup()`** ahora: (a) busca el segmento de HubSpot por nombre
   vía `fetchSegmentFromHubSpot` (mismo mecanismo que el Grupo Control), (b) toma
   `telefonos_validos` de la campaña ya elegida en el `<select>`, y (c) llama a
   `fetchConversionsForSmsGroup({ emails, phones, businessUnit, sendDate })`, que reemplaza al
   `fetchConversionsByPhoneFromMetabase` de la Fase 2.1 (eliminado). El tamaño de muestra del Grupo
   SMS (`smsN`) sigue siendo `muestra_entregados` — HubSpot en este flujo solo aporta emails para el
   cruce, nunca vuelve a redefinir el tamaño de muestra (eso sería un retroceso a antes de ADR 0008).

3. **Hermes (`metabaseService.js`) gana `fetchConversionsFromWarehouseCombined()`**, que reemplaza a
   `fetchConversionsFromWarehouseByPhone()` (Fase 2.1, eliminada). Hace el match de negocio pedido —
   `(customers.email IN (...) OR customers.phone IN (...))` — en dos fases para poder trocear cada
   lista en lotes sin superar el límite de payload del servidor MCP (ver ADR 0006, "FIX 413"):
   primero resuelve, deduplicados en un `Set` en memoria, los `customer_id` de `silver.customers`
   que matchean por CUALQUIERA de las dos vías (`collectMatchedCustomerIds`), y luego agrega
   `silver.sales` por esos `customer_id` ya resueltos (`aggregateSalesForCustomerIds`). Deduplicar
   antes de tocar `silver.sales` es lo que garantiza que un cliente que matchea por email Y por
   teléfono a la vez nunca se cuenta dos veces.

4. **`/api/metabase/conversions` distingue el modo por la presencia de `phones`** en el body: si
   viene, usa el cruce combinado (Grupo SMS); si no, el cruce solo-email de siempre (Grupo Control,
   sin cambios desde ADR 0006).

5. **Migración 004** corrige el `unique constraint` de `sms_processed_campaigns`: de
   `(campaign_name, country_value)` a `campaign_name` solo. `processedCampaignsService.js` actualiza
   su `onConflict` a `'campaign_name'`. Un upsert con la misma data no es distinguible de "no hacer
   nada" en Postgres/PostgREST — sobreescribir con valores idénticos es inofensivo, así que no se
   agregó lógica de diff explícita para "ignorar si es exactamente igual".

## Consecuencias

- Aplicar la migración 004 (además de la 003, si todavía no se aplicó) antes de que el upsert de
  `/upload` funcione con el identificador correcto.
- **Riesgo aceptado explícitamente**: si Workingbits reutilizara el mismo `Communication Name` para
  campañas de países distintos, la segunda carga sobreescribiría a la primera (incluido su
  `country_value`). Es el comportamiento que el usuario pidió; no se agregó ninguna validación que
  lo bloquee.
- El Grupo SMS ahora depende de HubSpot otra vez (como antes de ADR 0008) — si la lista de HubSpot
  no existe o está vacía, `searchSmsGroup()` sigue pudiendo cruzar solo por teléfono (emails vacío no
  rompe `fetchConversionsFromWarehouseCombined`, que acepta ambas listas vacías salvo que las dos lo
  estén a la vez).
- Sigue sin resolverse (ver ADR 0008): el formato exacto de `To`/`Send At` del CSV real de
  Workingbits no se ha verificado contra un archivo de ejemplo.

## Alternativas consideradas

- **Un único SQL con `OR` gigante en vez de dos fases**: descartado porque emails y teléfonos deben
  trocearse en lotes independientes por el límite de payload del servidor MCP — un solo `WHERE`
  combinado con ambas listas completas superaría ese límite para segmentos grandes.
- **Migrar también el cruce del Grupo Control a pasar por `silver.customers`**: descartado por
  alcance — el usuario no lo pidió, y el cruce directo por email contra `silver.sales.email` ya
  funciona correctamente para ese grupo (ADR 0006).

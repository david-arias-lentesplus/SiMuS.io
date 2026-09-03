# 0011 — El Grupo SMS deja de relacionar silver.customers; cruza solo por email, igual que el Grupo Control

Fecha: 2026-09-03
Estado: Aceptado (corrige/simplifica ADR 0009 y ADR 0010; decisión explícita del usuario)

## Contexto

Tras el rediseño de rendimiento de ADR 0010 (arrancar el `join` desde `silver.sales` ya acotada, en
vez de escanear `silver.customers` sin acotar) y el fix del `left join` para el email real de la
venta, el usuario reportó que el problema seguía sin resolverse:

> "seguimos teniendo errores y tiempos de carga muy largos, no como antes"

Y pidió explícitamente:

> "hagamos un cambio, que la consulta del grupo sms funcione igual que grupo de control, no
> relacionar con silver.customer y asi podemos agilizar un poco esta consulta"

Es decir: aunque ADR 0010 ya evitaba escanear `silver.customers` sin acotar, el `join`/`left join` en
sí — incluso partiendo de un conjunto pequeño de `silver.sales` — seguía siendo más costoso de lo
aceptable en producción. La instrucción del usuario es clara: eliminar por completo la dependencia de
`silver.customers` en el cruce del Grupo SMS.

## Aclaración previa (sesión anterior, "como relacionas la base de hubspot con la que se carga en el
csv")

Ya se había establecido que HubSpot (emails) y el CSV de Workingbits (teléfonos) NO se relacionan
entre sí técnicamente — se corresponden solo por convención humana (el nombre de lista que el usuario
escribe a mano). Cada identificador se buscaba de forma independiente contra Metabase con un `OR`.
Este ADR va un paso más allá: en vez de buscar por los dos identificadores, el Grupo SMS ahora busca
ÚNICAMENTE por email — igual que el Grupo Control.

## Decisión

`fetchConversionsFromWarehouseCombined` (el punto de entrada del cruce del Grupo SMS) ahora delega
directamente en `fetchConversionsFromWarehouse` (el mismo usado por el Grupo Control): consulta
`silver.sales` por `email IN (...)`, sin ningún `join`, exactamente igual código y mismo camino de
ejecución para ambos grupos.

Los `phones` que Éter extrae del CSV de Workingbits siguen llegando a la función (se reciben en la
firma por compatibilidad con el llamador, `api/metabase/conversions.js` y
`fetchConversionsForSmsGroup.js`, que no cambiaron), pero se ignoran por completo para este cruce
específico contra Metabase.

**Esto NO afecta** el tamaño de muestra del Grupo SMS (`smsN` = `muestra_entregados`, seguimiento
estricto de `Status === 'Delivered'` del CSV) — esa lógica vive en Éter/`useCampaignCalculator` y no
se toca. Lo único que cambia es CONTRA QUÉ se cruzan las conversiones en Metabase.

## Código eliminado (código muerto tras este cambio)

En `src/agents/hermes/services/metabaseService.js`:
- `buildCombinedSalesQuery` (la consulta con `join`/`left join` a `silver.customers`, de ADR 0010).
- `sanitizePhones` y la constante `PHONE_RE` (ya no se valida ningún teléfono en este archivo).
- `runRowsQuery` (ejecutaba consultas que devuelven filas; ya no queda ningún caller — el único flujo
  restante es agregado, `runAggregateQuery`).
- La constante `CUSTOMERS_TABLE = 'silver.customers'`.

`node --check` confirma que el archivo queda sintácticamente válido tras la eliminación.

## Trade-off aceptado explícitamente por el usuario

Un cliente que en `silver.customers` matchee SOLO por teléfono (no por email, o con un email que la
lista de HubSpot no incluya) **ya no se cuenta** como conversión del Grupo SMS. Antes (ADR 0009/0010)
ese cliente sí se contaba gracias al cruce por teléfono. El usuario decidió priorizar explícitamente
la velocidad/estabilidad de la consulta sobre esta cobertura adicional.

## Estado de verificación

No se pudo probar este cambio end-to-end en producción desde este entorno (sin credenciales reales de
Metabase). El camino de código que ahora usa el Grupo SMS es EXACTAMENTE el mismo que ya usa el Grupo
Control desde ADR 0006 — no es una consulta nueva, así que no requiere una validación adicional de SQL
contra el conector de desarrollo (ya estaba validada). Pendiente que el usuario confirme que los
tiempos de carga vuelven a ser aceptables y que no aparecen más errores 502/Terminated.

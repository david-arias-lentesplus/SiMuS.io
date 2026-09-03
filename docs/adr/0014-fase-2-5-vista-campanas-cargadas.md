# 0014 — Fase 2.5: vista de gestión de campañas cargadas (CSV)

Fecha: 2026-09-03
Estado: Aceptado

## Contexto

Hasta esta fase, `sms_processed_campaigns` (las campañas que Éter agrupa de un CSV de
Workingbits, ANTES de calcular ROI — ver ADR 0008) solo se podía ver indirectamente, dentro
del `<select>` de "Nombre de la campaña" de la Calculadora. No había forma de: ver de un
vistazo qué se cargó, corregir un CSV subido por error (borrándolo), o saltar directo a
calcular el ROI de una campaña ya cargada sin pasar manualmente por el flujo país → campaña
de la Calculadora.

El usuario pidió una nueva vista `/campanas-cargadas` ("Campañas Procesadas") para cubrir
esto.

## Decisión

### 1. Vista nueva (Hefesto): `src/agents/hefesto/pages/ProcessedCampaignsPage.jsx`

Ruta `/campanas-cargadas`, admin-only (mismo criterio que `/upload` y `/calculadora`:
eliminar una campaña cargada por error es una acción de escritura destructiva). Reusa el
layout real de tarjeta blanca de `HistoryPage.jsx` (`rounded-card bg-card shadow-card`, con
un `border border-ink-300/40` agregado para el "borde sutil" pedido) — la instrucción
original nombraba las clases como `border-border`/`shadow-shadow`, pero esos tokens no
existen en `tailwind.config.js` de este proyecto; se usó el patrón real en su lugar (ver
comentario en el archivo).

Tabla: Fecha de Envío (formateada con `parseCsvDate` + `fmtDateShort`, tomando
`communication_start_date` con `send_date` como fallback — mismo criterio que
`useCampaignCalculator.js`), Nombre de la Campaña, País (badge `bg-blue-deep/10
text-blue-deep` — el patrón "light-blue" ya existente en `UsersSettingsPage.jsx`, no el
badge gris neutro que usa `HistoryPage.jsx` para país, que no es azul), Muestra Válida
(`muestra_entregados`), Acciones ("Calcular ROI", "Eliminar" con ícono de basurero rojo).
Buscador de texto libre por `campaign_name` (client-side, mismo patrón que
`HistoryPage.jsx`).

La etiqueta de país se resuelve puenteando `country_value` contra `countries_config`
(fuente de verdad desde ADR 0007) y, si no matchea ahí, contra el catálogo estático
histórico `COUNTRIES` — mismo puente que ya usa `useCampaignCalculator.js` para filtrar
esta misma tabla.

### 2. Puente hacia la Calculadora: `pendingProcessedCampaignId` (Minerva)

"Calcular ROI" no pasa el id por parámetro de URL — el proyecto ya tiene un store global de
Zustand (`useCampaignStore.js`, "único store de estado global de la app", regla dura de
Minerva) y ese es el mecanismo que ya usan filtros/orden/selección en el resto de la app. Se
agregó `pendingProcessedCampaignId` + `setPendingProcessedCampaignId` +
`consumePendingProcessedCampaignId` (deliberadamente NO reutilizando el
`selectedCampaignId`/`selectCampaign` que ya existía: ese es un id de `sms_campaigns`,
campaña YA calculada, un concepto distinto).

`useCampaignCalculator.js` (Minerva) agrega un `useEffect` que, al montar con un
`pendingProcessedCampaignId` presente y el catálogo de países + campañas ya cargados,
busca la campaña en la lista SIN filtrar por país (`allProcessedCampaigns` — antes
`processedCampaigns`, renombrada para dejar claro que es la lista completa, no la ya
filtrada) y completa país + campaña + fecha/mensaje/tipo de evento/tamaño de muestra en un
solo `setForm`. Se resolvió así, y no encadenando `setCountryValue()` +
`selectProcessedCampaign()` (las funciones que ya existían para el flujo manual), porque
esas dos actúan sobre `availableProcessedCampaigns` ya filtrada por el país ANTERIOR y
sobre el estado de un render anterior — encadenarlas habría arrastrado una condición de
carrera (el filtro por el país nuevo todavía no habría corrido cuando se intenta elegir la
campaña).

### 3. Deméter: orden y `deleteCampaign`

`processedCampaignsService.fetchProcessedCampaigns` cambia el orden de `created_at DESC` a
`send_date DESC` (con `created_at DESC` como desempate) — pedido explícito de la
instrucción: se quiere ver primero las campañas cuyo ENVÍO es más reciente, no las
cargadas/subidas más recientemente al sistema (no es lo mismo si alguien sube un CSV viejo
después de uno nuevo). `send_date` ya es texto `YYYY-MM-DD` desde el fix de Éter (ADR
0013), así que el orden lexicográfico coincide con el cronológico.

`useProcessedCampaigns.js` agrega `deleteCampaign` como alias de la función `remove` que ya
existía (mismo comportamiento) — la instrucción pedía ese nombre literal para el botón
"Eliminar"; se mantienen ambos nombres para no romper `CsvUploadForm.jsx`, que ya
consumía `save` de este mismo hook (no usa `remove`, pero por las dudas de otros
consumidores futuros no se quita).

## Estado de verificación

`node --check` OK en todos los `.js` tocados
(`processedCampaignsService.js`, `useProcessedCampaigns.js`, `useCampaignStore.js`,
`useCampaignCalculator.js`). Los `.jsx` (`ProcessedCampaignsPage.jsx`, `AppRoutes.jsx`,
`Sidebar.jsx`) se revisaron a mano y se verificó balance de llaves/paréntesis (no hay
checker de JSX en este entorno). NO se pudo probar contra la base de datos real ni la UI
corriendo (misma limitación de siempre: no hay `npm run dev` en este entorno). Pendiente
que el usuario confirme: (1) la vista `/campanas-cargadas` carga y lista lo esperado, (2)
"Calcular ROI" preselecciona correctamente país + campaña en la Calculadora, (3)
"Eliminar" borra la fila de Supabase y de la tabla, (4) el buscador filtra como se espera.

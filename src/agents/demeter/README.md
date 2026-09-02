# Deméter — código

Ver definición de rol en `.claude/agents/demeter.md`.

## Contenido de esta carpeta (Fase 1 — sesión 2026-09-01)

- `schema/001_sms_campaigns.sql` — esquema inicial de la tabla `sms_campaigns`,
  extraído de `computeMetrics()`/`calculate()` del prototipo HTML adjunto por
  el usuario. Incluye RLS placeholder (ver TODO en el propio archivo).
- `supabaseClient.js` — único punto de creación del cliente Supabase, ahora
  vía variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
  en vez de las credenciales que estaban hardcodeadas en el HTML original.
- `services/smsCampaignsService.js` — CRUD contra `sms_campaigns`.
- `hooks/useSmsCampaigns.js` — hook de React que expone `campaigns`,
  `loading`, `error`, `save`, `remove`, `removeAll` a Minerva/Hefesto.

## Pendiente de definir (actualizado)

- Tablas separadas para clientes (Hermes/HubSpot) y eventos crudos de envío
  (Iris/Workingbits) — hoy `sms_campaigns` asume una fila por campaña ya
  calculada, cargada manualmente. Cuando Iris defina el mecanismo de
  extracción, se necesitará un modelo de `sms_messages` /
  `sms_delivery_events` que agregue hacia esta tabla o la reemplace.
- Política de RLS real por rol (bloqueada por Eleuthia).
- Migrar la aplicación de la fórmula de ROI a una función/vista SQL
  (hoy se recalcula en el cliente y se persiste ya calculada; si la fórmula
  cambia, el histórico quedaría con valores calculados con la fórmula vieja
  — decisión pendiente de discutir con el usuario).

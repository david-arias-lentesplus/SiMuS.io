# Minerva — código

Ver definición de rol en `.claude/agents/minerva.md`.

## Contenido de esta carpeta (Fase 1 — sesión 2026-09-01)

- `store/useCampaignStore.js` — estado global (Zustand): filtros de fecha/
  país/búsqueda, orden de la tabla de histórico, selección activa.
- `hooks/useFilteredCampaigns.js` — combina `useSmsCampaigns()` de Deméter
  con el estado de este store; es el único hook que Hefesto debe consumir.
- `routes/AppRoutes.jsx` — rutas base: `/` (dashboard global), `/calculadora`
  (nueva campaña, calcula y persiste vía Deméter), `/historico` (tabla +
  búsqueda + export, según el prototipo HTML original).

## Decisión de esta sesión

Se eligió **Zustand** como librería de estado global (coincide con el
patrón de Proyecto Faro en `AGENTS_SYSTEM_HANDOFF.md` y evita boilerplate
de Redux para el tamaño actual del proyecto). El usuario mencionó
explícitamente "entorno React" para Fase 1, por lo que se asumió **React +
Vite + react-router-dom** en vez de Next.js (ver ADR 0003) — Next.js había
quedado como supuesto sin confirmar en la sesión anterior.

## Pendiente de definir

- Filtros de primera clase adicionales (por estado de entrega, por tipo de
  evento) cuando Iris defina qué eventos crudos de Workingbits se
  persisten.
- Paginación/virtualización del histórico cuando el volumen de campañas
  crezca más allá de una tabla simple.

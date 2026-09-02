# Hefesto — código

Ver definición de rol en `.claude/agents/hefesto.md`.

## Contenido de esta carpeta (Fase 1 — sesión 2026-09-01)

- `layout/AppLayout.jsx`, `layout/Sidebar.jsx`, `layout/Topbar.jsx` —
  esqueleto de layout (sidebar oscura + topbar + contenido) según
  `image_dfbb87.png`.
- `components/KpiCard.jsx`, `components/ChartCard.jsx` — componentes
  presentacionales reutilizables para tarjetas de métricas y el contenedor
  de la gráfica de actividad.
- `pages/DashboardPage.jsx` — KPIs agregados conectados a datos reales.
- `pages/HistoryPage.jsx` — tabla completa de histórico (búsqueda, orden por
  columna, export CSV, eliminar fila/eliminar todo), migrada desde
  `renderHistoryTable()` del prototipo original.
- `pages/CalculatorPage.jsx` — sigue siendo un placeholder: falta migrar el
  formulario y el reporte de `computeMetrics()`/`calculate()`.
- `utils/format.js` — helpers `fmt$`/`fmtN`/`fmtPct`/`fmtDateShort`,
  migrados 1:1 desde el prototipo para mantener el mismo formato.
- `tokens/README.md` — de dónde salió cada valor en `tailwind.config.js`.

## Decisión de esta sesión

Framework de UI: **React + Vite + Tailwind CSS**, no Next.js (ver ADR 0003
en `docs/adr/`). Librería de gráficas: pendiente aún — `ChartCard.jsx` deja
el hueco listo para Chart.js/react-chartjs-2 (ya está en `package.json`)
pero no se implementó la gráfica real en esta sesión.

## Pendiente de definir

- Migrar el formulario de `computeMetrics()`/`calculate()` del prototipo
  HTML a `CalculatorPage.jsx` (inputs de muestra SMS/control, reporte
  comparativo, botón "Calcular y Guardar").
- Migrar la tabla completa de histórico (búsqueda, orden por columna,
  export, eliminar) a `HistoryPage.jsx`.
- Implementar la gráfica real de `ChartCard` con react-chartjs-2 una vez
  Minerva agregue una serie temporal (hoy `useFilteredCampaigns` solo
  expone `stats` agregados, no series por fecha).
- Confirmar con el usuario si la paleta extraída de `image_dfbb87.png` es
  la paleta de marca definitiva o solo una referencia de layout.

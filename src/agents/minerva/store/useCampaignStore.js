import { create } from 'zustand';

// Minerva — único store de estado global de la app.
// Regla dura: ningún componente de Hefesto mantiene estado compartido por
// su cuenta (filtros, selección activa, orden de tabla); todo vive aquí.
// Minerva NO sabe nada del esquema crudo de Supabase: solo trabaja con los
// objetos que ya devuelve el hook de Deméter (useSmsCampaigns).
export const useCampaignStore = create((set) => ({
  // --- Filtros del dashboard / histórico ---
  filters: {
    search: '',           // busca por campaign_name o country
    country: 'all',       // 'all' | nombre de país
    // BUG corregido 2026-09-01: el default estaba en '30d', lo que ocultaba
    // TODO el histórico real (las 17 campañas ya guardadas en Supabase son
    // de junio 2026, fuera de esa ventana) tanto en el Dashboard como en
    // HistoryPage, porque ambos consumen el mismo filtro. Default correcto
    // es 'all'. TODO(Minerva/Hefesto): en el prototipo original, el rango
    // de fecha solo filtraba la gráfica de actividad, nunca la tabla de
    // histórico — separar ambos usos cuando se implemente la gráfica real.
    dateRange: 'all',      // 'today' | '7d' | '30d' | '90d' | 'all'
  },
  setSearch: (search) =>
    set((state) => ({ filters: { ...state.filters, search } })),
  setCountry: (country) =>
    set((state) => ({ filters: { ...state.filters, country } })),
  setDateRange: (dateRange) =>
    set((state) => ({ filters: { ...state.filters, dateRange } })),

  // --- Orden de la tabla de histórico ---
  sort: { col: 'created_at', asc: false },
  setSort: (col) =>
    set((state) => ({
      sort:
        state.sort.col === col
          ? { col, asc: !state.sort.asc }
          : { col, asc: false },
    })),

  // --- Selección activa (campaña abierta en modo detalle/solo lectura) ---
  selectedCampaignId: null,
  selectCampaign: (id) => set({ selectedCampaignId: id }),
  clearSelection: () => set({ selectedCampaignId: null }),

  // --- Puente "Calcular ROI" (Fase 2.5, VISTA DE GESTIÓN DE CAMPAÑAS
  // CARGADAS) ---
  // No confundir con `selectedCampaignId` de arriba: ese es un id de
  // `sms_campaigns` (campaña YA calculada/guardada, histórico). Este es
  // un id de `sms_processed_campaigns` (campaña CSV de Éter, sin
  // calcular todavía) que /campanas-cargadas deja acá al pulsar
  // "Calcular ROI", para que useCampaignCalculator.js (Minerva) lo
  // recoja al montar la Calculadora y preseleccione país + campaña — ver
  // ese hook para el consumo y limpieza de este valor.
  pendingProcessedCampaignId: null,
  setPendingProcessedCampaignId: (id) => set({ pendingProcessedCampaignId: id }),
  consumePendingProcessedCampaignId: () => set({ pendingProcessedCampaignId: null }),

  // --- Filtros del Dashboard Global (Fase 2.7, "COMPLETITUD DE
  // DASHBOARD, GRÁFICAS Y FILTROS REACTIVOS") ---
  // Deliberadamente separados de `filters` de arriba: `filters` es del
  // Histórico (búsqueda de texto + el `dateRange`/`country` legacy que
  // ninguna UI llegó a exponer todavía) y sus consumidores
  // (HistoryPage/useCampaignCalculator vía useFilteredCampaigns) no deben
  // verse afectados si el usuario filtra el Dashboard por fecha/evento —
  // son vistas distintas con necesidades de filtro distintas. Los
  // setters escriben directo (auto-aplican al cambiar, sin un botón
  // "Aplicar" intermedio) porque `useSmsCampaigns` (Deméter) refetcha
  // automáticamente cuando el objeto de filtros cambia de referencia
  // (ver ese hook) — "Actualizar" en la UI dispara un `reload()` manual
  // (para traer campañas nuevas sin cambiar filtros), "Limpiar filtros"
  // vuelve todo a sus valores por defecto.
  dashboardFilters: {
    dateFrom: '',   // 'YYYY-MM-DD' o '' (sin límite inferior) — filtra send_date >= dateFrom
    dateTo: '',     // 'YYYY-MM-DD' o '' (sin límite superior) — filtra send_date <= dateTo
    country: 'all', // 'all' o el nombre exacto guardado en sms_campaigns.country
    eventType: 'all', // 'all' o uno de EVENT_TYPES (sms_campaigns.event_type)
  },
  setDashboardDateFrom: (dateFrom) =>
    set((state) => ({ dashboardFilters: { ...state.dashboardFilters, dateFrom } })),
  setDashboardDateTo: (dateTo) =>
    set((state) => ({ dashboardFilters: { ...state.dashboardFilters, dateTo } })),
  setDashboardCountry: (country) =>
    set((state) => ({ dashboardFilters: { ...state.dashboardFilters, country } })),
  setDashboardEventType: (eventType) =>
    set((state) => ({ dashboardFilters: { ...state.dashboardFilters, eventType } })),
  clearDashboardFilters: () =>
    set({ dashboardFilters: { dateFrom: '', dateTo: '', country: 'all', eventType: 'all' } }),
}));

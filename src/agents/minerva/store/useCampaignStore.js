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
}));

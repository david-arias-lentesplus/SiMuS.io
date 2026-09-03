import { useMemo } from 'react';
import { useSmsCampaigns } from '../../demeter/hooks/useSmsCampaigns.js';
import { useCampaignStore } from '../store/useCampaignStore.js';
import { getMonthlyData, getCountryData } from '../utils/aggregateCampaigns.js';

// Minerva — hook de "organización" único del Dashboard Global (Fase 2.7,
// "COMPLETITUD DE DASHBOARD, GRÁFICAS Y FILTROS REACTIVOS"). Reemplaza a
// useFilteredCampaigns()/useCampaignActivitySeries() como fuente de datos
// de DashboardPage.jsx — esos dos hooks NO se borran (regla de "no
// borrar archivos en desuso sin confirmación explícita", ver
// AGENTS_SYSTEM_HANDOFF.md) porque HistoryPage.jsx y useCampaignCalculator
// todavía dependen de useFilteredCampaigns; solo dejan de usarse en el
// Dashboard.
//
// Lee `dashboardFilters` del store (Minerva) y se los pasa TAL CUAL a
// useSmsCampaigns (Deméter), que ya sabe traducirlos a `gte`/`lte`/`eq`
// contra Supabase (ver smsCampaignsService.fetchCampaigns) — el filtrado
// real ocurre en la base de datos, no en memoria, para que "Ranking de
// campañas" no dependa de haber traído de más.
//
// `ranking`: TODAS las campañas ya filtradas, ordenadas de mayor a menor
// por `roi_real` — a propósito SIN `.slice()`/límite, la instrucción de
// Fase 2.7 pidió explícitamente que el ranking muestre el total de
// campañas filtradas, no un top fijo (la Fase 2.6 anterior sí limitaba a
// 5, eso queda revertido acá).
export function useDashboardCampaigns() {
  const dashboardFilters = useCampaignStore((s) => s.dashboardFilters);
  const { campaigns, loading, error, reload } = useSmsCampaigns(dashboardFilters);

  const stats = useMemo(() => {
    const n = campaigns.length;
    if (n === 0) return { total: 0, roiAvg: null, roiBest: null, countries: 0 };
    const rois = campaigns.map((r) => r.roi_real * 100);
    const roiAvg = rois.reduce((a, b) => a + b, 0) / n;
    const roiBest = Math.max(...rois);
    const countries = new Set(campaigns.map((r) => r.country)).size;
    return { total: n, roiAvg, roiBest, countries };
  }, [campaigns]);

  const ranking = useMemo(
    () => [...campaigns].sort((a, b) => (b.roi_real ?? 0) - (a.roi_real ?? 0)),
    [campaigns]
  );

  const monthly = useMemo(() => getMonthlyData(campaigns), [campaigns]);
  const byCountry = useMemo(() => getCountryData(campaigns), [campaigns]);

  return { campaigns, stats, ranking, monthly, byCountry, loading, error, reload };
}

import { useMemo } from 'react';
import { useSmsCampaigns } from '../../demeter/hooks/useSmsCampaigns.js';
import { useEventTypes } from '../../demeter/hooks/useEventTypes.js';
import { useCampaignStore } from '../store/useCampaignStore.js';
import { getMonthlyData, getCountryData, withIncrementalGain } from '../utils/aggregateCampaigns.js';
import { mergeEventTypes } from '../utils/detectEventType.js';

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
// Fase 2.8 (2026-09-03, "REFINAMIENTO DE DASHBOARD, TIPOS DE EVENTO
// DINÁMICOS Y ESTADOS DE CÁLCULO"): `ranking` ahora ordena por
// `incremental_gain` DESCENDENTE (no por `roi_real` como en Fase 2.6/2.7
// — pedido explícito: "el ORDER BY sea explícitamente por la ganancia
// incremental... no por ROI"), usando `withIncrementalGain()` para
// adjuntar ese valor recalculado a cada fila (ver aggregateCampaigns.js
// — `sms_campaigns` no guarda `incremental_gain` como columna). Sigue
// SIN límite/`.slice()` — el ranking completo de campañas filtradas.
// También expone `eventTypes` (catálogo dinámico para el filtro "Tipo de
// evento" de la barra de DashboardFilters — combina EVENT_TYPES estático
// con los DISTINCT de sms_campaigns vía useEventTypes/mergeEventTypes,
// sin el sentinel "Otro" que solo tiene sentido en el formulario de la
// Calculadora).
export function useDashboardCampaigns() {
  const dashboardFilters = useCampaignStore((s) => s.dashboardFilters);
  const { campaigns, loading, error, reload } = useSmsCampaigns(dashboardFilters);
  const { eventTypes: dbEventTypes } = useEventTypes();

  const stats = useMemo(() => {
    const n = campaigns.length;
    if (n === 0) return { total: 0, roiAvg: null, roiBest: null, countries: 0 };
    const rois = campaigns.map((r) => r.roi_real * 100);
    const roiAvg = rois.reduce((a, b) => a + b, 0) / n;
    const roiBest = Math.max(...rois);
    const countries = new Set(campaigns.map((r) => r.country)).size;
    return { total: n, roiAvg, roiBest, countries };
  }, [campaigns]);

  const ranking = useMemo(() => {
    const enriched = withIncrementalGain(campaigns);
    return enriched.sort((a, b) => (b.incremental_gain ?? 0) - (a.incremental_gain ?? 0));
  }, [campaigns]);

  const monthly = useMemo(() => getMonthlyData(campaigns), [campaigns]);
  const byCountry = useMemo(() => getCountryData(campaigns), [campaigns]);
  const eventTypes = useMemo(() => mergeEventTypes(dbEventTypes), [dbEventTypes]);

  return { campaigns, stats, ranking, monthly, byCountry, eventTypes, loading, error, reload };
}

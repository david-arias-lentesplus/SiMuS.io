import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../layout/Topbar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import ChartCard from '../components/ChartCard.jsx';
import MonthlyChart from '../components/MonthlyChart.jsx';
import GeoChart from '../components/GeoChart.jsx';
import DashboardFilters from '../components/DashboardFilters.jsx';
import { useDashboardCampaigns } from '../../minerva/hooks/useDashboardCampaigns.js';
import { useCountriesConfig } from '../../demeter/hooks/useCountriesConfig.js';
import { useCampaignStore } from '../../minerva/store/useCampaignStore.js';
import { COUNTRIES as STATIC_COUNTRIES_FALLBACK } from '../../minerva/constants/countries.js';
import { fmt$, fmtPct, fmtDateShort } from '../utils/format.js';

// Hefesto — Dashboard global. Consume únicamente hooks de "organización"
// de Minerva; nunca toca Deméter/Supabase directo.
//
// Fase 2.6 (2026-09-03): se agregó la tabla "Ranking de campañas" con
// columna "Acciones" → botón "Ver" que navega a /reporte/:id
// (CampaignReportPage.jsx, detalle read-only reutilizando el diseño del
// reporte de la Calculadora).
//
// Fase 2.7 (2026-09-03, "COMPLETITUD DE DASHBOARD, GRÁFICAS Y FILTROS
// REACTIVOS"): reemplaza useFilteredCampaigns()/useCampaignActivitySeries()
// por useDashboardCampaigns() (Minerva) — ese hook YA filtra en Supabase
// (Deméter) por lo que el usuario elija en la nueva barra de
// DashboardFilters (Desde/Hasta/País/Tipo de evento, ver
// useCampaignStore.dashboardFilters) y ya trae el ranking COMPLETO (sin
// límite) y las series agregadas para las dos gráficas nuevas:
//   - "Evolución mensual del canal" (MonthlyChart, combo barras+línea)
//     reemplaza al ChartCard "Actividad de campañas" (ActivityChart +
//     useCampaignActivitySeries, que se mantienen en el árbol sin uso —
//     no se borran archivos sin confirmación explícita del usuario, ver
//     AGENTS_SYSTEM_HANDOFF.md).
//   - "Rendimiento geográfico" (GeoChart, barras horizontales por país).
// El dropdown de País se puebla dinámicamente desde countries_config
// (Supabase, vía useCountriesConfig — mismo catálogo que administra
// /settings/countries), no de un array estático.
//
// Fase 2.8 (2026-09-03, "REFINAMIENTO DE DASHBOARD, TIPOS DE EVENTO
// DINÁMICOS Y ESTADOS DE CÁLCULO"): "Tipo de evento" del filtro ya no usa
// el catálogo estático EVENT_TYPES directo — usa `dashboard.eventTypes`
// (useDashboardCampaigns, Minerva), que combina ese catálogo con los
// valores DISTINCT reales de `sms_campaigns.event_type` (ver
// useEventTypes.js, Deméter), así que cualquier tipo "Otro" que alguien
// haya escrito a mano en la Calculadora aparece acá automáticamente. El
// Ranking de campañas ganó las columnas "Fecha envío" y "Ganancia Incr."
// y ahora ordena por ganancia incremental descendente (antes por ROI,
// ver useDashboardCampaigns.js); las primeras 3 filas llevan medalla
// 🥇🥈🥉 y un tinte de fondo sutil.
// Fase 2.8: medallas + tinte de fondo sutil para el podio del Ranking de
// campañas (posiciones 1-3, índice 0-2). Índices sin medalla quedan sin
// tinte (undefined -> '' vía RANK_TINTS[idx] ?? '' en el render).
const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const RANK_TINTS = ['bg-amber-50', 'bg-slate-50', 'bg-orange-50'];

export default function DashboardPage() {
  const { stats, ranking, monthly, byCountry, eventTypes, loading, error, reload } = useDashboardCampaigns();
  const { countries: countriesConfig, loading: countriesLoading } = useCountriesConfig({ onlyActive: true });
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const dashboardFilters = useCampaignStore((s) => s.dashboardFilters);
  const setDashboardDateFrom = useCampaignStore((s) => s.setDashboardDateFrom);
  const setDashboardDateTo = useCampaignStore((s) => s.setDashboardDateTo);
  const setDashboardCountry = useCampaignStore((s) => s.setDashboardCountry);
  const setDashboardEventType = useCampaignStore((s) => s.setDashboardEventType);
  const clearDashboardFilters = useCampaignStore((s) => s.clearDashboardFilters);

  const countryOptions = useMemo(() => {
    if (countriesConfig.length > 0) return countriesConfig.map((c) => c.country_name);
    return STATIC_COUNTRIES_FALLBACK.map((c) => c.label);
  }, [countriesConfig]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="mt-6 space-y-6">
        {error ? (
          <p className="text-sm text-state-danger">Error al cargar campañas: {error.message}</p>
        ) : null}

        <DashboardFilters
          filters={dashboardFilters}
          onDateFrom={setDashboardDateFrom}
          onDateTo={setDashboardDateTo}
          onCountry={setDashboardCountry}
          onEventType={setDashboardEventType}
          onClear={clearDashboardFilters}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          countries={countryOptions}
          countriesLoading={countriesLoading}
          eventTypes={eventTypes}
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Campañas" value={loading ? '—' : stats.total} />
          <KpiCard
            label="ROI promedio"
            value={loading || stats.roiAvg == null ? '—' : `${stats.roiAvg.toFixed(1)}%`}
            accent={stats.roiAvg >= 0 ? 'success' : 'danger'}
          />
          <KpiCard
            label="Mejor ROI"
            value={loading || stats.roiBest == null ? '—' : `${stats.roiBest.toFixed(1)}%`}
            accent="brand"
          />
          <KpiCard label="Países" value={loading ? '—' : stats.countries} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Evolución mensual del canal"
            subtitle="Ganancia incremental (barras) y ROI incremental (línea), agrupado por mes de envío"
          >
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-400">Cargando...</div>
            ) : monthly.labels.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-400">
                Todavía no hay campañas con fecha de envío para graficar.
              </div>
            ) : (
              <MonthlyChart labels={monthly.labels} incrementalGain={monthly.incrementalGain} roiPct={monthly.roiPct} />
            )}
          </ChartCard>

          <ChartCard title="Rendimiento geográfico" subtitle="Ganancia incremental por país">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-400">Cargando...</div>
            ) : byCountry.labels.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-400">
                Todavía no hay campañas para graficar.
              </div>
            ) : (
              <GeoChart labels={byCountry.labels} incrementalGain={byCountry.incrementalGain} />
            )}
          </ChartCard>
        </div>

        <div className="rounded-card bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-700">
              Ranking de campañas
            </h2>
            <span className="text-xs text-ink-400">
              {loading ? '' : `${ranking.length} campaña${ranking.length === 1 ? '' : 's'}`}
            </span>
          </div>
          {loading ? (
            <p className="text-sm text-ink-400">Cargando...</p>
          ) : ranking.length === 0 ? (
            <p className="text-sm text-ink-400">
              Ninguna campaña coincide con los filtros elegidos.
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-ink-300/40 text-xs uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-3 text-center">#</th>
                    <th className="py-2 pr-3">Campaña</th>
                    <th className="py-2 pr-3">País</th>
                    <th className="py-2 pr-3">Fecha envío</th>
                    <th className="py-2 pr-3">ROI</th>
                    <th className="py-2 pr-3">Ganancia Incr.</th>
                    <th className="py-2 pr-3">Costo SMS</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, idx) => {
                    const roi = r.roi_real * 100;
                    const medal = RANK_MEDALS[idx];
                    const rowTint = RANK_TINTS[idx] ?? '';
                    return (
                      <tr key={r.id} className={`border-b border-ink-300/20 last:border-0 ${rowTint}`}>
                        <td className="py-2 pr-3 text-center text-base" title={`Posición ${idx + 1}`}>
                          {medal ?? <span className="text-xs text-ink-400">{idx + 1}</span>}
                        </td>
                        <td className="py-2 pr-3 font-medium text-ink-900">{r.campaign_name}</td>
                        <td className="py-2 pr-3">
                          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-700">
                            {r.country}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-ink-500">
                          {r.send_date ? fmtDateShort(r.send_date) : 'N/A'}
                        </td>
                        <td
                          className={`py-2 pr-3 tabular-nums font-semibold ${
                            roi >= 0 ? 'text-state-success' : 'text-state-danger'
                          }`}
                        >
                          {fmtPct(roi)}
                        </td>
                        <td
                          className={`py-2 pr-3 tabular-nums ${
                            r.incremental_gain >= 0 ? 'text-state-success' : 'text-state-danger'
                          }`}
                        >
                          {fmt$(r.incremental_gain)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{fmt$(r.total_sms_cost)}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/reporte/${r.id}`)}
                            title="Ver reporte"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-500 hover:bg-surface hover:text-brand-teal"
                          >
                            <EyeIcon /> Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

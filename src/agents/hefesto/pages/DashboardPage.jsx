import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../layout/Topbar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import ChartCard from '../components/ChartCard.jsx';
import ActivityChart from '../components/ActivityChart.jsx';
import { useFilteredCampaigns } from '../../minerva/hooks/useFilteredCampaigns.js';
import { useCampaignActivitySeries } from '../../minerva/hooks/useCampaignActivitySeries.js';
import { fmt$, fmtPct } from '../utils/format.js';

const RANKING_SIZE = 5;

// Hefesto — Dashboard global. Consume únicamente hooks de "organización"
// de Minerva (useFilteredCampaigns, useCampaignActivitySeries); nunca toca
// Deméter/Supabase directo.
//
// Fase 2.6 (2026-09-03, "AMPLIACIÓN DE DASHBOARD, HISTÓRICO Y VISTAS DE
// DETALLE"): se agregó la tabla "Ranking de campañas" (top 5 por ROI real,
// ordenadas en memoria a partir de `campaigns` que ya trae
// useFilteredCampaigns — mismo patrón que el memo de `countries` en
// HistoryPage.jsx, no amerita un hook nuevo de Minerva solo para un
// sort().slice()) con una columna final "Acciones" — botón "Ver" que
// navega a /reporte/:id (CampaignReportPage.jsx), la nueva vista de
// detalle read-only que reutiliza el diseño del reporte de la
// Calculadora.
export default function DashboardPage() {
  const { stats, campaigns, loading, error } = useFilteredCampaigns();
  const activity = useCampaignActivitySeries();
  const navigate = useNavigate();

  const ranking = useMemo(
    () => [...campaigns].sort((a, b) => (b.roi_real ?? 0) - (a.roi_real ?? 0)).slice(0, RANKING_SIZE),
    [campaigns]
  );

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="mt-6 space-y-6">
        {error ? (
          <p className="text-sm text-state-danger">Error al cargar campañas: {error.message}</p>
        ) : null}
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
        <ChartCard title="Actividad de campañas">
          {activity.loading ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-400">Cargando...</div>
          ) : activity.error ? (
            <div className="flex h-full items-center justify-center text-sm text-state-danger">
              Error al cargar la actividad: {activity.error.message}
            </div>
          ) : activity.isEmpty ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-400">
              Todavía no hay campañas con fecha de envío para graficar.
            </div>
          ) : (
            <ActivityChart labels={activity.labels} smsSent={activity.smsSent} roiAvgPct={activity.roiAvgPct} />
          )}
        </ChartCard>

        <div className="rounded-card bg-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-700">
            Ranking de campañas
          </h2>
          {loading ? (
            <p className="text-sm text-ink-400">Cargando...</p>
          ) : ranking.length === 0 ? (
            <p className="text-sm text-ink-400">Todavía no hay campañas calculadas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-300/40 text-xs uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-3">Campaña</th>
                    <th className="py-2 pr-3">País</th>
                    <th className="py-2 pr-3">ROI</th>
                    <th className="py-2 pr-3">Costo SMS</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => {
                    const roi = r.roi_real * 100;
                    return (
                      <tr key={r.id} className="border-b border-ink-300/20 last:border-0">
                        <td className="py-2 pr-3 font-medium text-ink-900">{r.campaign_name}</td>
                        <td className="py-2 pr-3">
                          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-700">
                            {r.country}
                          </span>
                        </td>
                        <td
                          className={`py-2 pr-3 tabular-nums font-semibold ${
                            roi >= 0 ? 'text-state-success' : 'text-state-danger'
                          }`}
                        >
                          {fmtPct(roi)}
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

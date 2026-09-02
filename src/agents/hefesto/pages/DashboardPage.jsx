import Topbar from '../layout/Topbar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import ChartCard from '../components/ChartCard.jsx';
import { useFilteredCampaigns } from '../../minerva/hooks/useFilteredCampaigns.js';

// Hefesto — Dashboard global. Consume únicamente el hook de "organización"
// de Minerva (useFilteredCampaigns); nunca toca Deméter/Supabase directo.
export default function DashboardPage() {
  const { stats, loading, error } = useFilteredCampaigns();

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
          {/* TODO(Hefesto + Minerva): integrar react-chartjs-2 alimentado
              por la serie histórica que Minerva agregue por fecha. */}
          <div className="flex h-full items-center justify-center text-sm text-ink-400">
            Gráfica pendiente de datos históricos agregados por Minerva.
          </div>
        </ChartCard>
      </div>
    </>
  );
}

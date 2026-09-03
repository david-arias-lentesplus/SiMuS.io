import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Tooltip,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { CHART_COLORS } from '../tokens/chartColors.js';
import { fmt$ } from '../utils/format.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, Tooltip);

// Hefesto — "Rendimiento geográfico" (Fase 2.7, Dashboard Global). Barras
// horizontales de ganancia incremental (USD) por país, ya ordenadas de
// mayor a menor por Minerva (useDashboardCampaigns -> getCountryData, ver
// aggregateCampaigns.js) — este componente solo pinta, no ordena ni
// agrega nada.
export default function GeoChart({ labels, incrementalGain }) {
  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Ganancia incremental',
          data: incrementalGain,
          backgroundColor: CHART_COLORS.geoBarBg,
          borderColor: CHART_COLORS.geoBar,
          borderWidth: 1,
          borderRadius: 4,
          barThickness: 18,
        },
      ],
    }),
    [labels, incrementalGain]
  );

  const options = useMemo(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: CHART_COLORS.grid },
          ticks: { color: CHART_COLORS.tick, callback: (v) => fmt$(v) },
        },
        y: {
          grid: { display: false },
          ticks: { color: CHART_COLORS.tick },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Ganancia incremental: ${fmt$(ctx.parsed.x)}`,
          },
        },
      },
    }),
    []
  );

  return <Chart type="bar" data={data} options={options} />;
}

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  BarController,
  LineController,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { CHART_COLORS } from '../tokens/chartColors.js';
import { fmt$ } from '../utils/format.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  BarController,
  LineController,
  Tooltip,
  Legend
);

// Hefesto — "Evolución mensual del canal" (Fase 2.7, Dashboard Global).
// Combo chart de eje dual, mismo patrón que ActivityChart.jsx: barras =
// ganancia incremental (USD) por mes de envío (eje izquierdo); línea =
// ROI incremental (%) recalculado sobre la suma del mes (eje derecho).
// Componente presentacional puro: recibe la serie YA agregada por
// Minerva (useDashboardCampaigns -> getMonthlyData, ver
// aggregateCampaigns.js) vía props.
export default function MonthlyChart({ labels, incrementalGain, roiPct }) {
  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Ganancia Incremental (USD)',
          data: incrementalGain,
          backgroundColor: CHART_COLORS.gainBar,
          borderColor: CHART_COLORS.gainBar,
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'ROI Incremental (%)',
          data: roiPct,
          borderColor: CHART_COLORS.roiLineIncremental,
          backgroundColor: CHART_COLORS.roiLineIncrementalBg,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHART_COLORS.roiLineIncremental,
          yAxisID: 'y1',
        },
      ],
    }),
    [labels, incrementalGain, roiPct]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: CHART_COLORS.tick },
        },
        y: {
          position: 'left',
          beginAtZero: true,
          grid: { color: CHART_COLORS.grid },
          ticks: { color: CHART_COLORS.tick, callback: (v) => fmt$(v) },
          title: { display: true, text: 'Ganancia Incremental', color: CHART_COLORS.tick },
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          grid: { display: false },
          ticks: { color: CHART_COLORS.tick, callback: (v) => `${v}%` },
          title: { display: true, text: 'ROI Incremental (%)', color: CHART_COLORS.tick },
        },
      },
      plugins: {
        legend: { position: 'top', labels: { color: CHART_COLORS.tick, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ctx.dataset.yAxisID === 'y1'
                ? `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
                : `${ctx.dataset.label}: ${fmt$(ctx.parsed.y)}`,
          },
        },
      },
    }),
    []
  );

  return <Chart type="bar" data={data} options={options} />;
}

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { CHART_COLORS } from '../tokens/chartColors.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

// Hefesto — gráfica de "Actividad de campañas" del Dashboard. Componente
// presentacional puro: recibe la serie YA agregada por Minerva
// (useCampaignActivitySeries) vía props, nunca toca Supabase ni calcula
// nada. Barras = SMS enviados por período (eje izquierdo); línea = ROI
// real promedio (%) de ese período (eje derecho).
export default function ActivityChart({ labels, smsSent, roiAvgPct }) {
  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'SMS enviados',
          data: smsSent,
          backgroundColor: CHART_COLORS.smsSentBarBg,
          borderColor: CHART_COLORS.smsSentBar,
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'ROI real promedio',
          data: roiAvgPct,
          borderColor: CHART_COLORS.roiLine,
          backgroundColor: CHART_COLORS.roiLineBg,
          tension: 0.3,
          pointRadius: 3,
          yAxisID: 'y1',
        },
      ],
    }),
    [labels, smsSent, roiAvgPct]
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
          ticks: { color: CHART_COLORS.tick },
          title: { display: true, text: 'SMS enviados', color: CHART_COLORS.tick },
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          grid: { display: false },
          ticks: { color: CHART_COLORS.tick, callback: (v) => `${v}%` },
          title: { display: true, text: 'ROI real (%)', color: CHART_COLORS.tick },
        },
      },
      plugins: {
        legend: { position: 'top', labels: { color: CHART_COLORS.tick, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ctx.dataset.yAxisID === 'y1'
                ? `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
                : `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('es-CO')}`,
          },
        },
      },
    }),
    []
  );

  return <Chart type="bar" data={data} options={options} />;
}

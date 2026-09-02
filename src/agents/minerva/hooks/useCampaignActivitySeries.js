import { useMemo } from 'react';
import { useFilteredCampaigns } from './useFilteredCampaigns.js';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Minerva — agrega el histórico de campañas (ya filtrado/ordenado por
 * useFilteredCampaigns) en una serie temporal para el ChartCard
 * "Actividad de campañas" del Dashboard.
 *
 * Con el esquema actual de `sms_campaigns` (una fila = una campaña ya
 * calculada, sin eventos de entrega crudos — eso es Iris/Workingbits,
 * todavía sin integrar) lo único que se puede graficar honestamente es
 * volumen (SMS enviados) y desempeño (ROI real promedio) por período. La
 * gráfica de Sent/Received/Delivered/Failed/Opt-outs que sugieren los
 * tokens `metric.*` de tailwind.config.js queda pendiente hasta que Iris
 * traiga eventos de entrega reales — ver HANDOFF.md.
 *
 * Agrupa por día si el rango cubierto es corto (<=21 días) o por mes si
 * es más largo, para no terminar con decenas de barras vacías.
 */
export function useCampaignActivitySeries() {
  const { campaigns, loading, error } = useFilteredCampaigns();

  const series = useMemo(() => {
    const withDate = campaigns.filter((c) => c.send_date || c.created_at);
    if (withDate.length === 0) {
      return { labels: [], smsSent: [], roiAvgPct: [], groupBy: 'day' };
    }

    const dateOf = (c) => new Date(c.send_date || c.created_at);
    const sorted = [...withDate].sort((a, b) => dateOf(a) - dateOf(b));
    const first = dateOf(sorted[0]);
    const last = dateOf(sorted[sorted.length - 1]);
    const spanDays = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
    const groupBy = spanDays <= 21 ? 'day' : 'month';

    const keyOf = (d) => (groupBy === 'day' ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 7));

    const buckets = new Map();
    for (const c of sorted) {
      const key = keyOf(dateOf(c));
      if (!buckets.has(key)) buckets.set(key, { smsSent: 0, roiSum: 0, count: 0 });
      const b = buckets.get(key);
      b.smsSent += Number(c.sms_sample) || 0;
      b.roiSum += Number(c.roi_real) || 0;
      b.count += 1;
    }

    const keys = Array.from(buckets.keys()).sort();
    const labels = keys.map((k) => formatLabel(k, groupBy));
    const smsSent = keys.map((k) => buckets.get(k).smsSent);
    const roiAvgPct = keys.map((k) => {
      const b = buckets.get(k);
      return b.count > 0 ? (b.roiSum / b.count) * 100 : 0;
    });

    return { labels, smsSent, roiAvgPct, groupBy };
  }, [campaigns]);

  return { ...series, loading, error, isEmpty: series.labels.length === 0 };
}

function formatLabel(key, groupBy) {
  if (groupBy === 'day') {
    const [, m, d] = key.split('-');
    return `${d}/${m}`;
  }
  const [y, m] = key.split('-');
  return `${MESES[Number(m) - 1]} ${y}`;
}

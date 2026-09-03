import { computeMetrics } from './computeMetrics.js';

// Minerva — utilidades puras de agregación para las gráficas del
// Dashboard Global (Fase 2.7, "COMPLETITUD DE DASHBOARD, GRÁFICAS Y
// FILTROS REACTIVOS"). Reciben el array de filas crudas de
// `sms_campaigns` (ya filtradas por Deméter/Supabase — ver
// useDashboardCampaigns.js) y devuelven los datos ya transformados que
// consumen MonthlyChart.jsx y GeoChart.jsx.
//
// La instrucción original ubicaba estas funciones en Deméter
// ("Agrupación de Datos para Gráficas"), pero agrupar/sumar un array que
// YA está en memoria es cálculo puro sin acceso a Supabase — mismo tipo
// de función que computeMetrics.js o detectEventType.js, que ya viven en
// Minerva (ver .claude/agents/deméter.md: su dominio es acceso a datos,
// no lógica de negocio). Se documenta acá el mismo criterio ya usado en
// ADR 0014 para no repetir la discusión.
//
// `sms_campaigns` NO guarda `incremental_gain`/`total_sms_cost` como
// campos "puros" reutilizables entre sí (total_sms_cost sí se guarda,
// incremental_gain no) — se RECALCULA cada fila con computeMetrics() a
// partir de los campos crudos guardados (sms_sample/sms_conv/sms_sales/
// ctrl_*), mismo criterio que useCampaignReport.js (Fase 2.6): una sola
// fuente de verdad para la fórmula, nunca un mapeo de lectura duplicado.

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function toMetrics(row) {
  return computeMetrics({
    name: row.campaign_name,
    countryName: row.country,
    smsCost: Number(row.sms_cost_unit) || 0,
    sendDate: row.send_date,
    smsMessage: row.sms_message,
    eventType: row.event_type,
    smsN: Number(row.sms_sample) || 0,
    smsC: Number(row.sms_conv) || 0,
    smsS: Number(row.sms_sales) || 0,
    ctrlN: Number(row.ctrl_sample) || 0,
    ctrlC: Number(row.ctrl_conv) || 0,
    ctrlS: Number(row.ctrl_sales) || 0,
  });
}

function formatMonthLabel(key) {
  const [y, m] = key.split('-');
  return `${MESES[Number(m) - 1]} ${y}`;
}

/**
 * Agrupa por mes de envío (YYYY-MM, extraído de `send_date`), sumando
 * ganancia incremental e inversión (costo total de SMS) de cada campaña
 * del mes para RECALCULAR el ROI incremental mensual sobre los totales
 * — no promedia los ROI individuales de cada campaña, evita que una
 * campaña con costo mínimo distorsione el promedio del mes (mismo
 * problema que ya advertía el comentario de useCampaignActivitySeries.js
 * sobre ROI% pudiendo dispararse con costos de SMS muy bajos).
 * Filas sin `send_date` se excluyen (no hay mes al que asignarlas).
 */
export function getMonthlyData(campaigns) {
  const buckets = new Map();
  for (const row of campaigns) {
    if (!row.send_date) continue;
    const m = toMetrics(row);
    const key = row.send_date.slice(0, 7);
    if (!buckets.has(key)) buckets.set(key, { gain: 0, cost: 0 });
    const b = buckets.get(key);
    b.gain += m.incrementalGain;
    b.cost += m.totalCost;
  }

  const keys = Array.from(buckets.keys()).sort();
  const labels = keys.map(formatMonthLabel);
  const incrementalGain = keys.map((k) => buckets.get(k).gain);
  const roiPct = keys.map((k) => {
    const b = buckets.get(k);
    return b.cost > 0 ? ((b.gain - b.cost) / b.cost) * 100 : 0;
  });

  return { labels, incrementalGain, roiPct };
}

/**
 * Fase 2.8 ("REFINAMIENTO DE DASHBOARD..."): adjunta `incremental_gain`
 * (recalculado con computeMetrics(), mismo criterio que el resto de este
 * archivo) a cada fila cruda de `sms_campaigns`, sin mutar el original —
 * lo usa el Ranking de campañas del Dashboard, que ahora ordena por
 * ganancia incremental descendente en vez de por ROI (pedido explícito
 * de esta fase: "no por ROI").
 */
export function withIncrementalGain(campaigns) {
  return campaigns.map((row) => ({ ...row, incremental_gain: toMetrics(row).incrementalGain }));
}

/**
 * Agrupa por país sumando la ganancia incremental de cada campaña, y
 * devuelve la lista YA ordenada de mayor a menor (GeoChart.jsx solo
 * pinta, no ordena).
 */
export function getCountryData(campaigns) {
  const buckets = new Map();
  for (const row of campaigns) {
    const m = toMetrics(row);
    const key = row.country || 'Sin país';
    buckets.set(key, (buckets.get(key) || 0) + m.incrementalGain);
  }

  const sorted = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);
  return {
    labels: sorted.map(([label]) => label),
    incrementalGain: sorted.map(([, value]) => value),
  };
}

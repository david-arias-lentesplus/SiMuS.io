import { useMemo } from 'react';
import { useCampaignById } from '../../demeter/hooks/useCampaignById.js';
import { computeMetrics } from '../utils/computeMetrics.js';

// Minerva — hook de "organización" para la vista de detalle read-only
// (`/reporte/:id`, Fase 2.6). Toma la fila cruda de `sms_campaigns` que
// trae Deméter (useCampaignById) y la mapea al mismo objeto `m` que
// produce computeMetrics() en la Calculadora, para poder reutilizar
// CalculatorReport.jsx tal cual (KPIs, tabla comparativa, detalle
// financiero, ROI banner) sin duplicar esa lógica de presentación.
//
// Se RECALCULA con computeMetrics() en vez de leer los campos derivados
// ya guardados en la fila (lift_conv, roi_real, etc.) porque esos valores
// vinieron originalmente de esa misma función — recalcular garantiza que
// el reporte de detalle sea idéntico al que se aprobó, y evita mantener
// dos mapeos distintos (uno de guardado, otro de lectura) que puedan
// desincronizarse.
export function useCampaignReport(id) {
  const { campaign, loading, error } = useCampaignById(id);

  const report = useMemo(() => {
    if (!campaign) return null;
    return computeMetrics({
      name: campaign.campaign_name,
      countryName: campaign.country,
      smsCost: Number(campaign.sms_cost_unit) || 0,
      sendDate: campaign.send_date,
      smsMessage: campaign.sms_message,
      eventType: campaign.event_type,
      smsN: Number(campaign.sms_sample) || 0,
      smsC: Number(campaign.sms_conv) || 0,
      smsS: Number(campaign.sms_sales) || 0,
      ctrlN: Number(campaign.ctrl_sample) || 0,
      ctrlC: Number(campaign.ctrl_conv) || 0,
      ctrlS: Number(campaign.ctrl_sales) || 0,
    });
  }, [campaign]);

  return { report, campaign, loading, error };
}

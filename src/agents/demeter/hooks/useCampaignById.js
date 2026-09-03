import { useEffect, useState } from 'react';
import { fetchCampaignById } from '../services/smsCampaignsService.js';

// Deméter — hook de datos para la vista de detalle read-only
// (`/reporte/:id`, Fase 2.6). Única puerta de entrada que Minerva debe
// usar para leer UNA campaña ya calculada de `sms_campaigns` por id;
// nunca importar smsCampaignsService.js directamente desde un componente
// de UI (misma regla que useSmsCampaigns.js).
export function useCampaignById(id) {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setCampaign(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCampaignById(id)
      .then((data) => {
        if (!cancelled) setCampaign(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { campaign, loading, error };
}

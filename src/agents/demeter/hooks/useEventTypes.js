import { useEffect, useState } from 'react';
import { fetchDistinctEventTypes } from '../services/smsCampaignsService.js';

// Deméter — hook de datos para "Tipo de evento" dinámico (Fase 2.8,
// "TIPOS DE EVENTO DINÁMICOS"). Única puerta de entrada que Minerva debe
// usar para leer los valores DISTINCT de `sms_campaigns.event_type`;
// nunca importar smsCampaignsService.js directamente desde un componente
// de UI (misma regla que useSmsCampaigns.js/useCampaignById.js).
//
// Dos consumidores: el filtro "Tipo de evento" del Dashboard
// (useDashboardCampaigns.js) y el <select> de la Calculadora
// (useCampaignCalculator.js) — ambos combinan este resultado con el
// catálogo estático `EVENT_TYPES` vía `mergeEventTypes()`
// (detectEventType.js) para no quedar vacíos mientras `sms_campaigns`
// todavía no tiene filas.
export function useEventTypes() {
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDistinctEventTypes()
      .then((data) => {
        if (!cancelled) setEventTypes(data);
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
  }, []);

  return { eventTypes, loading, error };
}

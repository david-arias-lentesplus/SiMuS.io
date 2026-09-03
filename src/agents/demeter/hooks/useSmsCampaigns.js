import { useCallback, useEffect, useState } from 'react';
import {
  fetchCampaigns,
  insertCampaign,
  deleteCampaign,
  deleteAllCampaigns,
} from '../services/smsCampaignsService.js';

// Deméter — hook de datos. Es la única puerta de entrada que Minerva/
// Hefesto deben usar para leer o escribir campañas; nunca importar
// smsCampaignsService.js directamente desde un componente de UI.
//
// Fase 2.7 (2026-09-03, "FILTROS REACTIVOS"): acepta un `filters`
// opcional (ver fetchCampaigns() en el servicio) que se reenvía tal cual
// a Supabase. Default `null` (NUNCA `{}` literal) a propósito: un objeto
// literal en la firma crearía una referencia nueva en cada render y el
// `useEffect` de abajo entraría en loop de refetch infinito — `null` es
// un primitivo, estable entre renders. Quien SÍ pasa filtros (Minerva,
// useDashboardCampaigns.js) los lee de useCampaignStore, que solo cambia
// de referencia cuando el usuario realmente edita un filtro — eso es lo
// que dispara el refetch automático, sin que este hook tenga que saber
// nada de dónde vienen esos filtros.
export function useSmsCampaigns(filters = null) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCampaigns(filters || {});
      setCampaigns(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(
    async (metrics) => {
      const row = await insertCampaign(metrics);
      setCampaigns((prev) => [row, ...prev]);
      return row;
    },
    []
  );

  const remove = useCallback(async (id) => {
    await deleteCampaign(id);
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const removeAll = useCallback(async () => {
    await deleteAllCampaigns();
    setCampaigns([]);
  }, []);

  return { campaigns, loading, error, reload, save, remove, removeAll };
}

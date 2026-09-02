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
export function useSmsCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCampaigns();
      setCampaigns(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

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

import { useCallback, useEffect, useState } from 'react';
import {
  fetchProcessedCampaigns,
  upsertProcessedCampaigns,
  deleteProcessedCampaign,
} from '../services/processedCampaignsService.js';

// Deméter — hook de datos para `sms_processed_campaigns` (Fase 2.1).
// Dos consumidores: /upload (Hefesto, guarda el resultado de Éter) y la
// Calculadora (Minerva, solo lectura, puebla el <select> de campaña).
// `countryValue` es opcional: si se pasa, el hook re-consulta cada vez
// que cambia (la Calculadora lo usa para no ofrecer campañas de otro país).
export function useProcessedCampaigns({ countryValue } = {}) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await fetchProcessedCampaigns({ countryValue }));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [countryValue]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Guarda el lote agrupado por Éter (parseWorkingbitsCsv) para un país. */
  const save = useCallback(async (groups, forCountryValue) => {
    const rows = await upsertProcessedCampaigns(groups, forCountryValue);
    await reload(); // upsert puede reemplazar filas existentes; recargar es más simple/seguro que mergear a mano
    return rows;
  }, [reload]);

  const remove = useCallback(async (id) => {
    await deleteProcessedCampaign(id);
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Fase 2.5 ("VISTA DE GESTIÓN DE CAMPAÑAS CARGADAS"): la instrucción
  // pidió explícitamente una función `deleteCampaign(id)` para el botón
  // "Eliminar" de /campanas-cargadas. Es un alias de `remove` (mismo
  // comportamiento, ya usado por /upload para otros fines) — se
  // mantienen los dos nombres para no romper el consumidor existente de
  // CsvUploadForm.jsx.
  const deleteCampaign = remove;

  return { campaigns, loading, error, reload, save, remove, deleteCampaign };
}

import { useCallback, useEffect, useState } from 'react';
import {
  fetchCountriesConfig,
  insertCountryConfig,
  updateCountryConfig,
  deleteCountryConfig,
} from '../services/countriesConfigService.js';

// Deméter — hook de datos para el catálogo de países/tarifas (Fase 3,
// ADR 0007). Dos consumidores: la Calculadora (Minerva,
// `{ onlyActive: true }`, solo lectura) y /settings/countries (Hefesto,
// CRUD completo, solo accesible para admin).
export function useCountriesConfig({ onlyActive = false } = {}) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCountries(await fetchCountriesConfig({ onlyActive }));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (input) => {
    const row = await insertCountryConfig(input);
    setCountries((prev) => [...prev, row].sort((a, b) => a.country_name.localeCompare(b.country_name)));
    return row;
  }, []);

  const update = useCallback(async (id, input) => {
    const row = await updateCountryConfig(id, input);
    setCountries((prev) => prev.map((c) => (c.id === id ? row : c)));
    return row;
  }, []);

  const remove = useCallback(async (id) => {
    await deleteCountryConfig(id);
    setCountries((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { countries, loading, error, reload, create, update, remove };
}

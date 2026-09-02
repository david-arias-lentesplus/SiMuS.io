import { useCallback, useEffect, useState } from 'react';
import { fetchAllProfiles, updateProfileRole } from '../services/profilesService.js';

// Deméter — hook de datos para la vista de "Gestión de Usuarios" de
// Eleuthia/Hefesto (Fase 3, ADR 0007). Solo un admin puede leer la lista
// completa (RLS de public.profiles); si quien llama es viewer, Supabase
// devuelve solo su propia fila y esta pantalla ni siquiera es alcanzable
// (RequireAdmin la bloquea antes en el router de Minerva).
export function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfiles(await fetchAllProfiles());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setRole = useCallback(async (userId, role) => {
    const updated = await updateProfileRole(userId, role);
    setProfiles((prev) => prev.map((p) => (p.id === userId ? updated : p)));
    return updated;
  }, []);

  return { profiles, loading, error, reload, setRole };
}

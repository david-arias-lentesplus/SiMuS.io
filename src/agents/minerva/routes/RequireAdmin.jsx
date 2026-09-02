import { Navigate } from 'react-router-dom';
import { useAuth } from '../../eleuthia/hooks/useAuth.js';

// Minerva — Guard de rol (Fase 3, ADR 0007). Debe usarse SIEMPRE anidado
// dentro de <RequireAuth> (asume que ya hay sesión). Un viewer que
// navegue a mano a una ruta admin-only (/calculadora, /settings/*)
// rebota al Dashboard — la restricción real de todas formas la impone
// Supabase RLS del lado del servidor (ver migración 002); este Guard
// solo evita mostrarle una UI que de todas formas va a fallar.
export default function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

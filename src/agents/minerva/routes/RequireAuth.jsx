import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../eleuthia/hooks/useAuth.js';

// Minerva — Guard de autenticación (Fase 3, ADR 0007). Envuelve toda
// ruta protegida en AppRoutes.jsx; si no hay sesión activa, redirige a
// /login guardando la ruta de origen para volver ahí tras iniciar
// sesión (ver LoginPage.jsx en Hefesto).
export default function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

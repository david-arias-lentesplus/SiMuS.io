import AppLayout from './agents/hefesto/layout/AppLayout.jsx';
import AppRoutes from './agents/minerva/routes/AppRoutes.jsx';
import AuthGate from './agents/minerva/routes/AuthGate.jsx';
import { useAuth } from './agents/eleuthia/hooks/useAuth.js';

// Punto de ensamblaje: Hefesto provee el layout, Minerva provee las rutas
// que se renderizan dentro de él, Eleuthia decide si hay sesión.
//
// Fase 3 (2026-09-02): AuthGate bloquea el render hasta resolver la
// sesión guardada; mientras no haya sesión, se renderiza <AppRoutes/>
// SIN el AppLayout (sidebar/topbar) — cualquier ruta protegida rebota
// internamente a /login vía <RequireAuth>, así que nunca hay un momento
// en que se vea el layout de app autenticada sin sesión real. Ningún
// otro agente debe editar este archivo salvo para registrar un nuevo
// agente de layout/rutas de raíz.
export default function App() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}

function AppShell() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <AppRoutes />;
  }
  return (
    <AppLayout>
      <AppRoutes />
    </AppLayout>
  );
}

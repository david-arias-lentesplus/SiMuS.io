import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from '../../hefesto/pages/DashboardPage.jsx';
import CalculatorPage from '../../hefesto/pages/CalculatorPage.jsx';
import HistoryPage from '../../hefesto/pages/HistoryPage.jsx';
import LoginPage from '../../hefesto/pages/LoginPage.jsx';
import CountriesSettingsPage from '../../hefesto/pages/settings/CountriesSettingsPage.jsx';
import UsersSettingsPage from '../../hefesto/pages/settings/UsersSettingsPage.jsx';
import RequireAuth from './RequireAuth.jsx';
import RequireAdmin from './RequireAdmin.jsx';

// Minerva — única fuente de verdad de "dónde estoy" dentro del dashboard.
//
// Fase 3 (2026-09-02, "AUTENTICACIÓN, CONFIGURACIÓN Y UI POLISH"): todas
// las rutas quedaron protegidas con <RequireAuth> (Eleuthia decide si hay
// sesión); /calculadora y /settings/* además exigen <RequireAdmin> — un
// viewer puede ver Dashboard/Histórico pero no calcular campañas nuevas,
// eliminar histórico ni entrar a Configuración (ver ADR 0007). /login es
// la única ruta pública.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/calculadora"
        element={
          <RequireAuth>
            <RequireAdmin>
              <CalculatorPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/historico"
        element={
          <RequireAuth>
            <HistoryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/countries"
        element={
          <RequireAuth>
            <RequireAdmin>
              <CountriesSettingsPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/settings/users"
        element={
          <RequireAuth>
            <RequireAdmin>
              <UsersSettingsPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

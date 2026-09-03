import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from '../../hefesto/pages/DashboardPage.jsx';
import CalculatorPage from '../../hefesto/pages/CalculatorPage.jsx';
import HistoryPage from '../../hefesto/pages/HistoryPage.jsx';
import LoginPage from '../../hefesto/pages/LoginPage.jsx';
import CountriesSettingsPage from '../../hefesto/pages/settings/CountriesSettingsPage.jsx';
import UsersSettingsPage from '../../hefesto/pages/settings/UsersSettingsPage.jsx';
import UploadPage from '../../hefesto/pages/UploadPage.jsx';
import ProcessedCampaignsPage from '../../hefesto/pages/ProcessedCampaignsPage.jsx';
import CampaignReportPage from '../../hefesto/pages/CampaignReportPage.jsx';
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
//
// Pivote de Fase 2.1 (ADR 0008): se agregó /upload (carga de CSV de
// Workingbits), también admin-only por el mismo criterio que
// /calculadora — cargar campañas nuevas es una acción de escritura.
//
// Fase 2.5 ("VISTA DE GESTIÓN DE CAMPAÑAS CARGADAS"): se agregó
// /campanas-cargadas (gestión de las campañas que Éter agrupó del CSV,
// antes de calcular ROI) — admin-only por el mismo criterio que /upload:
// eliminar una campaña cargada por error es también una acción de
// escritura destructiva.
//
// Fase 2.6 (2026-09-03): se agregó /reporte/:id (detalle read-only de una
// campaña YA calculada de sms_campaigns, ver CampaignReportPage.jsx) —
// solo <RequireAuth>, sin <RequireAdmin>, porque es una vista de solo
// lectura a la que se llega desde el botón "Ver" del Dashboard, visible
// tanto para admin como para viewer (igual que /historico).
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
        path="/upload"
        element={
          <RequireAuth>
            <RequireAdmin>
              <UploadPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/campanas-cargadas"
        element={
          <RequireAuth>
            <RequireAdmin>
              <ProcessedCampaignsPage />
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
        path="/reporte/:id"
        element={
          <RequireAuth>
            <CampaignReportPage />
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

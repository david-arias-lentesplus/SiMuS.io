import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from '../../hefesto/pages/DashboardPage.jsx';
import CalculatorPage from '../../hefesto/pages/CalculatorPage.jsx';
import HistoryPage from '../../hefesto/pages/HistoryPage.jsx';

// Minerva — única fuente de verdad de "dónde estoy" dentro del dashboard.
// Vistas implícitas detectadas en el prototipo HTML (tabs de la calculadora):
//   - Calculadora de nueva campaña  -> /calculadora
//   - Histórico de campañas          -> /historico
//   - Dashboard global (KPIs/gráfico) -> /  (home)
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/calculadora" element={<CalculatorPage />} />
      <Route path="/historico" element={<HistoryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { Link, useParams } from 'react-router-dom';
import Topbar from '../layout/Topbar.jsx';
import CalculatorReport from '../components/calculator/CalculatorReport.jsx';
import { useCampaignReport } from '../../minerva/hooks/useCampaignReport.js';

// Hefesto — Reporte de Campaña (Fase 2.6, vista de detalle read-only).
// Reutiliza el mismo diseño de CalculatorReport.jsx que ya usa la
// Calculadora (KPIs, tabla comparativa, detalle financiero, ROI banner);
// la diferencia es que acá no hay formulario de ingreso ni botón de
// "Calcular" — solo la visualización pura de una campaña YA guardada en
// `sms_campaigns` (ver useCampaignReport, Minerva), con la sección de
// "Aprobación Explícita" oculta vía la prop `readOnly`.
//
// Se llega acá desde el botón "Ver" de la columna "Acciones" en el
// Ranking de campañas del Dashboard (ver DashboardPage.jsx), que navega
// a `/reporte/:id` con el id de `sms_campaigns`.
export default function CampaignReportPage() {
  const { id } = useParams();
  const { report, loading, error } = useCampaignReport(id);

  return (
    <>
      <Topbar title="Reporte de Campaña" />
      <div className="no-print mt-6">
        <Link to="/" className="text-sm font-medium text-brand-teal hover:underline">
          ← Volver al Dashboard
        </Link>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-400">Cargando reporte...</p>
      ) : error ? (
        <p className="mt-6 text-sm text-state-danger">Error al cargar la campaña: {error.message}</p>
      ) : !report ? (
        <p className="mt-6 text-sm text-ink-400">No se encontró esta campaña.</p>
      ) : (
        <CalculatorReport report={report} readOnly />
      )}
    </>
  );
}

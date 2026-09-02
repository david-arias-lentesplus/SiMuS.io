import Topbar from '../layout/Topbar.jsx';
import CampaignForm from '../components/calculator/CampaignForm.jsx';
import CalculatorReport from '../components/calculator/CalculatorReport.jsx';
import { useCampaignCalculator } from '../../minerva/hooks/useCampaignCalculator.js';

// Hefesto — página "Calculadora de Nueva Campaña" (Calculadora Híbrida,
// pivote de Fase 1, sesión 2026-09-02). Componente presentacional: todo el
// estado del formulario, la simulación de búsqueda de segmentos y el
// cálculo/guardado viven en useCampaignCalculator (Minerva); esta página
// solo ensambla el layout y decide cuándo mostrar el reporte.
export default function CalculatorPage() {
  const calc = useCampaignCalculator();

  return (
    <>
      <Topbar title="Calculadora de Nueva Campaña" />
      <div className="no-print mt-6">
        <CampaignForm calc={calc} />
      </div>
      <CalculatorReport report={calc.report} approval={calc.approval} onApprove={calc.approveAndSave} />
    </>
  );
}

import Topbar from '../layout/Topbar.jsx';
import CsvUploadForm from '../components/upload/CsvUploadForm.jsx';

// Hefesto — página "Cargar CSV de Workingbits" (pivote de Fase 2.1, ver
// ADR 0008). Ruta admin-only (misma protección que /calculadora, ver
// AppRoutes.jsx). Componente presentacional puro: toda la lógica de
// parseo/agrupación vive en Éter y el guardado en Deméter, orquestados
// desde CsvUploadForm.jsx.
export default function UploadPage() {
  return (
    <>
      <Topbar title="Cargar CSV de Workingbits" />
      <div className="mt-6">
        <CsvUploadForm />
      </div>
    </>
  );
}

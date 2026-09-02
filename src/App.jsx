import AppLayout from './agents/hefesto/layout/AppLayout.jsx';
import AppRoutes from './agents/minerva/routes/AppRoutes.jsx';

// Punto de ensamblaje: Hefesto provee el layout, Minerva provee las rutas
// que se renderizan dentro de él. Ningún otro agente debe editar este
// archivo salvo para registrar un nuevo agente de layout/rutas de raíz.
export default function App() {
  return (
    <AppLayout>
      <AppRoutes />
    </AppLayout>
  );
}

import Sidebar from './Sidebar.jsx';

// Hefesto — AppLayout: Sidebar + contenido principal, según
// image_dfbb87.png (sidebar oscura fija a la izquierda, fondo gris muy
// claro, tarjetas blancas con sombra suave en el área de contenido).
// El Topbar se renderiza por página (cada página en src/agents/hefesto/pages
// decide su propio título), para no acoplar AppLayout a las rutas de
// Minerva.
export default function AppLayout({ children }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}

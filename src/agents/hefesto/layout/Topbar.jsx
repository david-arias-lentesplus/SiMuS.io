import UserMenu from '../components/UserMenu.jsx';

// Hefesto — barra superior (título de la sección actual + UserMenu).
// Fase 3 (2026-09-02, ADR 0007): el placeholder gris de sesión se
// reemplazó por <UserMenu/> ahora que Eleuthia expone el hook de sesión
// activa (iniciales, rol, "Configuración" si es admin, "Cerrar sesión").
export default function Topbar({ title }) {
  return (
    <header className="no-print flex h-16 items-center justify-between border-b border-ink-300/40 bg-card px-8">
      <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
      <UserMenu />
    </header>
  );
}

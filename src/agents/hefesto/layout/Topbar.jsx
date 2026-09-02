// Hefesto — barra superior mínima de Fase 1 (título de la sección actual +
// espacio reservado para acciones globales). Se mantiene deliberadamente
// simple hasta que Eleuthia defina el modelo de usuario/sesión a mostrar
// aquí (avatar, nombre, rol).
export default function Topbar({ title }) {
  return (
    <header className="no-print flex h-16 items-center justify-between border-b border-ink-300/40 bg-card px-8">
      <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
      {/* Placeholder: Eleuthia expondrá aquí el hook de sesión activa */}
      <div className="h-9 w-9 rounded-full bg-surface" aria-hidden="true" />
    </header>
  );
}

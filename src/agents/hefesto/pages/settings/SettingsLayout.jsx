import { NavLink } from 'react-router-dom';
import Topbar from '../../layout/Topbar.jsx';

// Hefesto — layout compartido de /settings/* (Fase 3, ADR 0007). Tarjetas
// blancas, tabs simples arriba del contenido — mismo lenguaje visual que
// el resto del dashboard (image_dfbb87.png). Solo accesible para admin
// (Minerva lo protege con <RequireAdmin> en AppRoutes.jsx).
export default function SettingsLayout({ title, children }) {
  return (
    <>
      <Topbar title={title} />
      <div className="mt-6">
        <div className="mb-4 flex gap-2 border-b border-ink-300/40">
          <SettingsTab to="/settings/countries" label="Países" />
          <SettingsTab to="/settings/users" label="Usuarios" />
        </div>
        {children}
      </div>
    </>
  );
}

function SettingsTab({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 pb-3 text-sm font-medium ${
          isActive ? 'border-b-2 border-blue-deep text-blue-deep' : 'text-ink-500 hover:text-ink-900'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../eleuthia/hooks/useAuth.js';

// Hefesto — Sidebar oscura, tomada de la referencia visual image_dfbb87.png
// (gradiente morado/marino de arriba a abajo, ícono de marca arriba,
// íconos de navegación centrados, botón de salir abajo).
//
// Fase 3 (2026-09-02, ADR 0007): la Calculadora es admin-only (`adminOnly`
// filtra el item para un viewer, aunque el router de Minerva igual
// bloquearía la ruta) y se agregó el ícono de Configuración (solo admin).
// El botón de salir, que antes no hacía nada, ahora dispara
// useAuth().signOut() de Eleuthia.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: ChartIcon },
  { to: '/upload', label: 'Cargar CSV', icon: UploadIcon, adminOnly: true }, // Fase 2.1, ADR 0008
  // Fase 2.5 ("VISTA DE GESTIÓN DE CAMPAÑAS CARGADAS"): gestión de las
  // campañas que Éter agrupó del CSV (editar/eliminar/enviar a calcular
  // ROI) — admin-only, mismo criterio que "Cargar CSV".
  { to: '/campanas-cargadas', label: 'Campañas Procesadas', icon: ListIcon, adminOnly: true },
  { to: '/calculadora', label: 'Calculadora', icon: MailIcon, adminOnly: true },
  { to: '/historico', label: 'Histórico', icon: ClockIcon },
];

export default function Sidebar() {
  const { isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const settingsActive = location.pathname.startsWith('/settings');

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="no-print flex h-full w-20 flex-col items-center justify-between bg-gradient-to-b from-sidebar-from to-sidebar-to py-6">
      <div className="flex flex-col items-center gap-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
          <BoltIcon />
        </div>
        <nav className="flex flex-col items-center gap-4">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={label}
              className={({ isActive }) =>
                `flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  isActive
                    ? 'bg-brand-teal text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon />
            </NavLink>
          ))}
          {isAdmin ? (
            <NavLink
              to="/settings/countries"
              title="Configuración"
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                settingsActive ? 'bg-brand-teal text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <SettingsIcon />
            </NavLink>
          ) : null}
        </nav>
      </div>
      <button
        type="button"
        title="Salir"
        onClick={handleLogout}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white"
      >
        <PowerIcon />
      </button>
    </aside>
  );
}

function iconProps() {
  return { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
}
function BoltIcon() { return (<svg {...iconProps()} className="text-white"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>); }
function ChartIcon() { return (<svg {...iconProps()}><path d="M3 3v18h18" /><path d="M7 13l4-4 3 3 5-6" /></svg>); }
function MailIcon() { return (<svg {...iconProps()}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>); }
function UploadIcon() { return (<svg {...iconProps()}><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 21h14" /></svg>); }
function ClockIcon() { return (<svg {...iconProps()}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>); }
function ListIcon() { return (<svg {...iconProps()}><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>); }
function PowerIcon() { return (<svg {...iconProps()}><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.8 0" /></svg>); }
function SettingsIcon() { return (<svg {...iconProps()}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>); }

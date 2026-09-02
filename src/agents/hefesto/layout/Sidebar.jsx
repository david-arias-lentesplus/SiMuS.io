import { NavLink } from 'react-router-dom';

// Hefesto — Sidebar oscura, tomada de la referencia visual image_dfbb87.png
// (gradiente morado/marino de arriba a abajo, ícono de marca arriba,
// íconos de navegación centrados, botón de salir abajo).
// Componente presentacional puro: no importa hooks de datos, solo recibe
// rutas de Minerva vía <NavLink>.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: ChartIcon },
  { to: '/calculadora', label: 'Calculadora', icon: MailIcon },
  { to: '/historico', label: 'Histórico', icon: ClockIcon },
];

export default function Sidebar() {
  return (
    <aside className="no-print flex h-full w-20 flex-col items-center justify-between bg-gradient-to-b from-sidebar-from to-sidebar-to py-6">
      <div className="flex flex-col items-center gap-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
          <BoltIcon />
        </div>
        <nav className="flex flex-col items-center gap-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
        </nav>
      </div>
      <button
        type="button"
        title="Salir"
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
function ClockIcon() { return (<svg {...iconProps()}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>); }
function PowerIcon() { return (<svg {...iconProps()}><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.8 0" /></svg>); }

// Hefesto — tarjeta de KPI reutilizable (tarjetas blancas con sombra suave
// y números grandes, según la referencia visual). Componente 100%
// presentacional: recibe valores ya formateados, nunca calcula nada.
export default function KpiCard({ label, value, accent = 'ink', hint }) {
  const accentClass = {
    ink: 'text-ink-900',
    success: 'text-state-success',
    danger: 'text-state-danger',
    brand: 'text-brand-teal',
  }[accent] ?? 'text-ink-900';

  return (
    <div className="rounded-card bg-card p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accentClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

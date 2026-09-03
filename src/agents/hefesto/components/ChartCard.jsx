// Hefesto — contenedor de la gráfica de actividad (área superior del
// dashboard en la referencia visual). El contenido real (líneas de
// Sent/Received/Delivered/Failed/Opt-outs con Chart.js) lo alimenta
// Minerva vía props `series`/`labels`; este componente solo define el
// marco visual (tarjeta blanca, título, leyenda) para no mezclar lógica
// de datos con presentación.
// Fase 2.7 (2026-09-03): agrega la prop opcional `subtitle` (línea gris
// chica debajo del título, ver referencia visual de "Evolución mensual
// del canal" / "Rendimiento geográfico") — retrocompatible, ChartCard
// sigue funcionando igual para quien no la pase (ActivityChart/Dashboard
// "Actividad de campañas", hoy sin uso pero no borrado, ver
// DashboardPage.jsx).
export default function ChartCard({ title, subtitle, children, legend }) {
  return (
    <div className="rounded-card bg-card p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-700">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-xs normal-case tracking-normal text-ink-400">{subtitle}</p> : null}
        </div>
        {legend ? <div className="flex items-center gap-3 text-xs text-ink-500">{legend}</div> : null}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

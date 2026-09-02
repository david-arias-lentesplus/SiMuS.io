// Hefesto — contenedor de la gráfica de actividad (área superior del
// dashboard en la referencia visual). El contenido real (líneas de
// Sent/Received/Delivered/Failed/Opt-outs con Chart.js) lo alimenta
// Minerva vía props `series`/`labels`; este componente solo define el
// marco visual (tarjeta blanca, título, leyenda) para no mezclar lógica
// de datos con presentación.
export default function ChartCard({ title, children, legend }) {
  return (
    <div className="rounded-card bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-700">
          {title}
        </h2>
        {legend ? <div className="flex items-center gap-3 text-xs text-ink-500">{legend}</div> : null}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

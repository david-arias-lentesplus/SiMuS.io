import KpiCard from '../KpiCard.jsx';
import { fmt$, fmtN, fmtPct, fmtDateShort } from '../../utils/format.js';

// Hefesto — reporte de impacto de la Calculadora Híbrida (pivote de Fase 1,
// sesión 2026-09-02). Recibe el objeto `m` YA calculado por
// useCampaignCalculator.calculate() (Minerva) y solo lo pinta: KPIs, tabla
// comparativa, detalle financiero y el botón de aprobación explícita que
// dispara el único insert real en Supabase.
//
// Fase 2.6 (2026-09-03): agrega la prop `readOnly` para reutilizar este
// mismo componente en /reporte/:id (CampaignReportPage.jsx, vista de
// detalle read-only del Dashboard) — oculta el subtítulo de "vista previa
// sin guardar" y todo el bloque de "Aprobación Explícita", ya que ahí el
// reporte YA está guardado y no hay nada que aprobar.
export default function CalculatorReport({ report, approval, onApprove, readOnly = false }) {
  if (!report) return null;
  const m = report;
  const roiPct = m.roiReal * 100;

  return (
    <div className="mt-6 space-y-6">
      <div className="no-print flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-ink-300/60 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface"
        >
          Imprimir / Exportar PDF
        </button>
      </div>

      <div className="rounded-card bg-sidebar-to p-6 text-white shadow-card">
        <p className="text-xs uppercase tracking-wide text-white/60">Reporte de Impacto — SMS Marketing</p>
        <h2 className="mt-1 text-2xl font-semibold">{m.name}</h2>
        <p className="mt-1 text-xs text-white/60">
          {readOnly
            ? 'Reporte guardado en el histórico'
            : `Calculado el ${fmtDateShort(new Date().toISOString())} — vista previa, aún no guardado en el histórico`}
        </p>
        {m.sendDate ? (
          <p className="mt-2 text-sm text-white/80">
            Fecha de envío: <strong>{fmtDateShort(m.sendDate)}</strong>
          </p>
        ) : null}
        {m.smsMessage ? (
          <div className="mt-4 rounded-lg bg-white/10 p-3">
            <p className="text-[10px] uppercase tracking-wide text-white/50">Mensaje enviado</p>
            <p className="mt-1 text-sm italic text-white/90">{m.smsMessage}</p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{m.countryName} — ${m.smsCost.toFixed(3)} / SMS</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{m.eventType}</span>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Indicadores clave de rendimiento
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Lift en Conversiones" value={fmtPct(m.liftConv)} accent={m.liftConv >= 0 ? 'success' : 'danger'} hint={`${fmtPct(m.liftConv)} vs. control`} />
          <KpiCard label="Lift en Tasa de Conv." value={fmtPct(m.liftCR)} hint="Mejora en CR del grupo SMS" />
          <KpiCard label="Costo Total SMS" value={fmt$(m.totalCost)} hint={`${fmtN(m.smsN)} envíos x ${fmt$(m.smsCost)}`} />
          <KpiCard label="ROI Real (Incremental)" value={fmtPct(roiPct)} accent={roiPct >= 0 ? 'success' : 'danger'} hint="Por cada $1 invertido en SMS" />
        </div>
      </div>

      <div className="rounded-card bg-card p-6 shadow-card">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Tabla comparativa de métricas
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-300/40 text-xs uppercase tracking-wide text-ink-500">
                <th className="py-2 pr-3">Métrica</th>
                <th className="py-2 pr-3">Grupo 1 - SMS</th>
                <th className="py-2 pr-3">Grupo 2 - Control</th>
                <th className="py-2">Impacto / Lift</th>
              </tr>
            </thead>
            <tbody>
              <MetricRow label="Tamaño de muestra" hint="Clientes en el grupo" sms={fmtN(m.smsN)} ctrl={fmtN(m.ctrlN)} lift="N/A" />
              <MetricRow
                label="Conversiones"
                hint="SMS vs. Control proyectado al mismo tamaño de muestra"
                sms={fmtN(m.smsC)}
                ctrl={<>{fmtN(m.ctrlConvProjected, 1)} <span className="text-ink-400">(real: {fmtN(m.ctrlC)})</span></>}
                lift={fmtPct(m.liftConv)}
              />
              <MetricRow label="Tasa de Conversión (CR)" hint="Conversiones / Muestra" sms={`${(m.smsCR * 100).toFixed(2)}%`} ctrl={`${(m.ctrlCR * 100).toFixed(2)}%`} lift={fmtPct(m.liftCR)} />
              <MetricRow label="Ticket Promedio (AOV)" hint="Ventas / Conversiones" sms={fmt$(m.smsAOV)} ctrl={fmt$(m.ctrlAOV)} lift={fmtPct(m.liftAOV)} />
              <MetricRow label="Ingreso por Cliente (RPC)" hint="Ventas / Muestra" sms={fmt$(m.smsRPC)} ctrl={fmt$(m.ctrlRPC)} lift={fmtPct(m.liftRPC)} />
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Detalle financiero</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-card bg-card p-5 shadow-card">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Ingresos y costos</p>
            <FinRow label="Ventas brutas - Grupo SMS" value={fmt$(m.smsS)} />
            <FinRow label="Ventas brutas - Grupo Control" value={fmt$(m.ctrlS)} />
            <FinRow label="Costo total envío SMS" value={fmt$(m.totalCost)} danger />
            <FinRow label="Ventas netas SMS" value={fmt$(m.netSmsSales)} strong />
          </div>
          <div className="rounded-card bg-card p-5 shadow-card">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Desglose ROI incremental</p>
            <FinRow label="Ventas orgánicas proyectadas" value={fmt$(m.organicSalesProjected)} />
            <FinRow label="Ganancia incremental" value={fmt$(m.incrementalGain)} />
            <FinRow label="Costo inversión SMS" value={fmt$(m.totalCost)} danger />
            <FinRow label="Numerador ROI" value={fmt$(m.numeratorROI)} strong />
          </div>
        </div>

        <div className="mt-4 rounded-card bg-sidebar-to p-6 text-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">ROI Real Incremental</p>
              <p className="text-xs text-white/60">
                Fórmula: (Ventas SMS − Costo SMS) − (RPC Control x N SMS) / Costo SMS
              </p>
            </div>
            <p className="text-3xl font-bold">{fmtPct(roiPct)}</p>
          </div>
        </div>
        <p className="mt-2 rounded-lg bg-card p-3 text-xs italic text-ink-500 shadow-card">
          Metodología: el ROI incremental descuenta la venta orgánica que hubiera ocurrido sin SMS, para
          aislar el impacto real del canal.
        </p>
      </div>

      {readOnly ? null : (
        <div className="no-print rounded-card bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink-900">Aprobación Explícita</p>
              <p className="text-xs text-ink-500">
                Este reporte solo existe en memoria. Solo se escribe en Supabase al aprobarlo.
              </p>
            </div>
            <button
              type="button"
              onClick={onApprove}
              disabled={approval.status === 'saving' || approval.status === 'saved'}
              className="rounded-lg bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal/90 disabled:opacity-50"
            >
              {approval.status === 'saving'
                ? 'Guardando...'
                : approval.status === 'saved'
                ? 'Guardado en Histórico ✓'
                : 'Aprobar y Guardar en Histórico'}
            </button>
          </div>
          {approval.status === 'error' ? (
            <p className="mt-2 text-xs text-state-danger">Error al guardar: {approval.error}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, hint, sms, ctrl, lift }) {
  return (
    <tr className="border-b border-ink-300/20 last:border-0">
      <td className="py-2 pr-3">
        <p className="font-medium text-ink-900">{label}</p>
        {hint ? <p className="text-xs text-ink-400">{hint}</p> : null}
      </td>
      <td className="py-2 pr-3 tabular-nums">{sms}</td>
      <td className="py-2 pr-3 tabular-nums">{ctrl}</td>
      <td className="py-2 tabular-nums">
        {lift === 'N/A' ? (
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-500">N/A</span>
        ) : (
          <span className="rounded-full bg-state-success/10 px-2 py-0.5 text-xs font-medium text-state-success">{lift}</span>
        )}
      </td>
    </tr>
  );
}

function FinRow({ label, value, danger, strong }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-300/20 py-2 last:border-0">
      <span className="text-sm text-ink-500">{label}</span>
      <span
        className={`tabular-nums text-sm ${danger ? 'text-state-danger' : strong ? 'font-semibold text-state-success' : 'text-ink-900'}`}
      >
        {value}
      </span>
    </div>
  );
}

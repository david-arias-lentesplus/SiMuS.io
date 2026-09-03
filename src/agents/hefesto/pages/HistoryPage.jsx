import { useEffect, useMemo, useState } from 'react';
import Topbar from '../layout/Topbar.jsx';
import { useFilteredCampaigns } from '../../minerva/hooks/useFilteredCampaigns.js';
import { useCampaignStore } from '../../minerva/store/useCampaignStore.js';
import { useAuth } from '../../eleuthia/hooks/useAuth.js';
import { fmt$, fmtN, fmtPct, fmtDateShort } from '../utils/format.js';

const PAGE_SIZE = 20;

// Hefesto — Histórico de Campañas.
// Migrado desde renderHistoryTable()/sortHistory()/loadCampaign() del
// prototipo HTML original. Componente presentacional: toda la data ya
// viene filtrada/ordenada por el hook de Minerva; este componente solo
// dispara acciones (buscar, ordenar, eliminar, exportar) a través de los
// setters/funciones que Minerva y Deméter exponen.
//
// Fase 3 (2026-09-02, ADR 0007):
//   - Paginación client-side (PAGE_SIZE=20) para no renderizar una tabla
//     infinita a medida que crece el histórico. `useFilteredCampaigns`
//     sigue trayendo TODAS las filas ya filtradas/ordenadas de Supabase
//     (Deméter no pagina la query todavía) — esta paginación solo recorta
//     lo que se pinta en pantalla. Si el histórico crece a varios miles
//     de filas, la siguiente mejora natural es paginar la query misma
//     (range() de Supabase) en vez de traer todo a memoria; queda anotado
//     en ADR 0007 como mejora futura, no bloqueante para esta entrega.
//   - Los botones de eliminar (fila o "eliminar todo") ahora se ocultan
//     para un viewer (RLS de sms_campaigns ya lo bloquea del lado del
//     servidor, esto solo evita mostrarle una acción que va a fallar).
//
// Fase 2.6 (2026-09-03, "AMPLIACIÓN DE DASHBOARD, HISTÓRICO Y VISTAS DE
// DETALLE"): se agregó la columna "Fecha Envío" (`send_date`, la fecha en
// que la campaña efectivamente se envió) junto a la columna existente
// "Fecha" (`created_at`, cuándo se calculó/guardó el registro) — Deméter
// ya traía `send_date` con el `select('*')` de fetchCampaigns(), no hizo
// falta tocar la query. Si `send_date` es null se muestra "N/A".
export default function HistoryPage() {
  const { campaigns, loading, error, remove, removeAll } = useFilteredCampaigns();
  const filters = useCampaignStore((s) => s.filters);
  const setSearch = useCampaignStore((s) => s.setSearch);
  const sort = useCampaignStore((s) => s.sort);
  const setSort = useCampaignStore((s) => s.setSort);
  const { isAdmin } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [busyAll, setBusyAll] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.country, filters.dateRange, sort.col, sort.asc]);

  const totalPages = Math.max(1, Math.ceil(campaigns.length / PAGE_SIZE));
  const pageCampaigns = useMemo(
    () => campaigns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [campaigns, page]
  );

  const countries = useMemo(
    () => Array.from(new Set(campaigns.map((c) => c.country))).sort(),
    [campaigns]
  );

  async function handleDelete(id, name) {
    if (!window.confirm(`¿Eliminar la campaña "${name}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setBusyId(id);
    try {
      await remove(id);
    } catch (e) {
      window.alert('Error al eliminar: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteAll() {
    if (
      !window.confirm(
        `¿Eliminar las ${campaigns.length} campañas del histórico? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setBusyAll(true);
    try {
      await removeAll();
    } catch (e) {
      window.alert('Error al eliminar todo: ' + e.message);
    } finally {
      setBusyAll(false);
    }
  }

  function handleExport() {
    // Exporta TODAS las filas filtradas, no solo la página actual.
    const headers = [
      'created_at', 'send_date', 'campaign_name', 'country',
      'sms_sample', 'sms_cr', 'lift_conv', 'roi_real', 'total_sms_cost', 'sms_message',
    ];
    const rows = campaigns.map((r) => headers.map((h) => csvCell(r[h])).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simus-historico-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Topbar title="Histórico de Campañas" />
      <div className="mt-6 rounded-card bg-card p-6 shadow-card">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por campaña o país..."
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-teal focus:outline-none"
          />
          <span className="text-xs text-ink-400">
            {countries.length} país{countries.length === 1 ? '' : 'es'} en el histórico
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={campaigns.length === 0}
              className="rounded-lg border border-ink-300/60 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface disabled:opacity-40"
            >
              Exportar CSV
            </button>
            {isAdmin ? (
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={campaigns.length === 0 || busyAll}
                className="rounded-lg border border-state-danger/40 px-3 py-2 text-xs font-medium text-state-danger hover:bg-state-danger/10 disabled:opacity-40"
              >
                {busyAll ? 'Eliminando...' : 'Eliminar todo'}
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="text-sm text-state-danger">Error al cargar campañas: {error.message}</p>
        ) : loading ? (
          <p className="text-sm text-ink-400">Cargando...</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-ink-400">
            {filters.search
              ? 'Ninguna campaña coincide con tu búsqueda.'
              : 'No hay campañas registradas aún.'}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-300/40 text-xs uppercase tracking-wide text-ink-500">
                    <SortableTh col="created_at" sort={sort} onSort={setSort}>Fecha</SortableTh>
                    <SortableTh col="send_date" sort={sort} onSort={setSort}>Fecha Envío</SortableTh>
                    <SortableTh col="campaign_name" sort={sort} onSort={setSort}>Campaña</SortableTh>
                    <SortableTh col="country" sort={sort} onSort={setSort}>País</SortableTh>
                    <SortableTh col="sms_sample" sort={sort} onSort={setSort}>Muestra</SortableTh>
                    <SortableTh col="sms_cr" sort={sort} onSort={setSort}>CR SMS</SortableTh>
                    <SortableTh col="lift_conv" sort={sort} onSort={setSort}>Lift</SortableTh>
                    <SortableTh col="roi_real" sort={sort} onSort={setSort}>ROI</SortableTh>
                    <SortableTh col="total_sms_cost" sort={sort} onSort={setSort}>Costo</SortableTh>
                    <th className="py-2 pr-3">Mensaje</th>
                    {isAdmin ? <th className="py-2" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {pageCampaigns.map((r) => {
                    const roi = r.roi_real * 100;
                    return (
                      <tr key={r.id} className="border-b border-ink-300/20 last:border-0">
                        <td className="py-2 pr-3 text-ink-500">{fmtDateShort(r.created_at)}</td>
                        <td className="py-2 pr-3 text-ink-500">{r.send_date ? fmtDateShort(r.send_date) : 'N/A'}</td>
                        <td className="py-2 pr-3 font-medium text-ink-900">{r.campaign_name}</td>
                        <td className="py-2 pr-3">
                          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-700">
                            {r.country}
                          </span>
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{fmtN(r.sms_sample)}</td>
                        <td className="py-2 pr-3 tabular-nums">{(r.sms_cr * 100).toFixed(2)}%</td>
                        <td className="py-2 pr-3 tabular-nums">{fmtPct(r.lift_conv)}</td>
                        <td
                          className={`py-2 pr-3 tabular-nums font-semibold ${
                            roi >= 0 ? 'text-state-success' : 'text-state-danger'
                          }`}
                        >
                          {fmtPct(roi)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{fmt$(r.total_sms_cost)}</td>
                        <td className="max-w-[220px] truncate py-2 pr-3 text-ink-400" title={r.sms_message || ''}>
                          {r.sms_message || '-'}
                        </td>
                        {isAdmin ? (
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleDelete(r.id, r.campaign_name)}
                              disabled={busyId === r.id}
                              className="rounded-lg px-2 py-1 text-xs text-state-danger hover:bg-state-danger/10 disabled:opacity-40"
                            >
                              {busyId === r.id ? '...' : 'Eliminar'}
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {campaigns.length > PAGE_SIZE ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
                <span>
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, campaigns.length)} de{' '}
                  {campaigns.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-ink-300/60 px-3 py-1.5 text-ink-700 hover:bg-surface disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="px-1">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-ink-300/60 px-3 py-1.5 text-ink-700 hover:bg-surface disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function SortableTh({ col, sort, onSort, children }) {
  const active = sort.col === col;
  return (
    <th
      className="cursor-pointer select-none py-2 pr-3 hover:text-ink-700"
      onClick={() => onSort(col)}
    >
      {children} {active ? (sort.asc ? '▲' : '▼') : ''}
    </th>
  );
}

function csvCell(value) {
  if (value == null) return '';
  const s = String(value).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

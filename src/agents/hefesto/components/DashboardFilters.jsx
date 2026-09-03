// Hefesto — barra de filtros del Dashboard Global (Fase 2.7,
// "COMPLETITUD DE DASHBOARD, GRÁFICAS Y FILTROS REACTIVOS"). Componente
// 100% presentacional/controlado: cada campo escribe directo en
// useCampaignStore vía los callbacks que recibe por props (nunca
// mantiene su propio estado de filtro) — quien orquesta sigue siendo
// Minerva (ver DashboardPage.jsx). "Actualizar" dispara un `reload()`
// manual (traer campañas nuevas sin cambiar filtros); los filtros ya se
// auto-aplican al cambiar porque useSmsCampaigns (Deméter) refetcha solo
// con que el objeto de filtros cambie de referencia — ver ese hook.
export default function DashboardFilters({
  filters,
  onDateFrom,
  onDateTo,
  onCountry,
  onEventType,
  onClear,
  onRefresh,
  refreshing,
  countries,
  countriesLoading,
  eventTypes,
}) {
  const selectClass =
    'w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-teal focus:outline-none disabled:opacity-50';

  return (
    <div className="rounded-card bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-end gap-4">
        <FilterField label="Desde">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onDateFrom(e.target.value)}
            className={selectClass}
          />
        </FilterField>

        <FilterField label="Hasta">
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onDateTo(e.target.value)}
            className={selectClass}
          />
        </FilterField>

        <FilterField label="País">
          <select
            value={filters.country}
            onChange={(e) => onCountry(e.target.value)}
            disabled={countriesLoading}
            className={selectClass}
          >
            <option value="all">Todos los países</option>
            {countries.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Tipo de evento">
          <select value={filters.eventType} onChange={(e) => onEventType(e.target.value)} className={selectClass}>
            <option value="all">Todos los tipos</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FilterField>

        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-ink-300/60 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface"
        >
          Limpiar filtros
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300/60 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface disabled:opacity-50"
        >
          <RefreshIcon spinning={refreshing} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <div className="min-w-[160px] flex-1">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function RefreshIcon({ spinning }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

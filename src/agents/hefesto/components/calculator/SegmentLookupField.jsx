// Hefesto — campo reutilizable para las secciones "Grupo SMS" y "Grupo
// Control" del formulario de la calculadora: nombre de lista de HubSpot +
// botón "Buscar". Componente 100% presentacional: la búsqueda real
// (Hermes -> HubSpot, Fase 2) y la simulación de conversiones (pendiente
// de Iris/Metabase) viven en useCampaignCalculator (Minerva); este
// componente solo dispara la acción que recibe por props.
export default function SegmentLookupField({ segmentName, onSegmentNameChange, onSearch, loading, error }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-500">
        Nombre exacto de la lista en HubSpot
      </label>
      <div className="mt-1 flex gap-2">
        <input
          type="text"
          value={segmentName}
          onChange={(e) => onSegmentNameChange(e.target.value)}
          placeholder="Ej. Clientes_LV_Activos_90d (nombre exacto de la lista en HubSpot)"
          className="flex-1 rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-teal focus:outline-none"
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={loading}
          className="whitespace-nowrap rounded-lg bg-brand-indigo px-4 py-2 text-sm font-medium text-white hover:bg-brand-indigo/90 disabled:opacity-50"
        >
          {loading ? 'Buscando en HubSpot...' : 'Buscar'}
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-state-danger">{error}</p> : null}
      <p className="mt-1 text-xs italic text-ink-400">
        Tamaño de muestra: real, vía HubSpot (Hermes). Conversiones: cruce simulado —
        integración con Metabase/Workingbits pendiente (Iris).
      </p>
    </div>
  );
}

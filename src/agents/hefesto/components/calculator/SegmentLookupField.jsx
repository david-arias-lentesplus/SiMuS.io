// Hefesto — campo reutilizable de "nombre de lista de HubSpot + botón
// Buscar". Desde el pivote de Fase 2.1 (ADR 0008) solo lo usa el Grupo
// Control: el Grupo SMS dejó de buscar en HubSpot y ahora cruza
// directamente los teléfonos del CSV de Workingbits contra Metabase (ver
// CampaignForm.jsx, sección "Grupo SMS"). Componente 100% presentacional:
// la búsqueda real (Hermes -> HubSpot, Fase 2) y el cruce real de
// conversiones/ventas (Hermes -> Metabase) viven en useCampaignCalculator
// (Minerva); este componente solo dispara la acción que recibe por props.
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
          {loading ? 'Buscando en HubSpot + Metabase...' : 'Buscar'}
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-state-danger">{error}</p> : null}
      <p className="mt-1 text-xs italic text-ink-400">
        Tamaño de muestra, conversiones y ventas: reales, vía HubSpot + Metabase (Hermes).
        Requiere haber elegido la fecha de envío arriba.
      </p>
      {/* Nota Fase 2.1 (ADR 0008): este flujo (HubSpot + Metabase por email) sigue vigente
          SOLO para el Grupo Control. El Grupo SMS usa telefonos_validos del CSV directamente. */}
    </div>
  );
}

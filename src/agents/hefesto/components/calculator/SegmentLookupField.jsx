// Hefesto — campo reutilizable de "nombre de lista de HubSpot + botón
// Buscar", usado por AMBOS grupos de la Calculadora (Grupo SMS y Grupo
// Control). Componente 100% presentacional: la búsqueda real (Hermes ->
// HubSpot) y el cruce real de conversiones/ventas (Hermes -> Metabase)
// viven en useCampaignCalculator (Minerva); este componente solo dispara
// la acción que recibe por props.
//
// Historial: el pivote de Fase 2.1 (ADR 0008) había quitado este campo
// del Grupo SMS (cruzaba solo por teléfono, sin HubSpot). La corrección
// de Fase 2.2 (ADR 0009) lo restauró: el CSV de Workingbits solo trae
// teléfonos, pero el cruce contra Metabase también necesita los emails
// de una lista de HubSpot — ver useCampaignCalculator.searchSmsGroup.
// `disabled` es nuevo en Fase 2.2: el Grupo SMS lo usa para bloquear la
// búsqueda hasta que el usuario elija una campaña del CSV.
export default function SegmentLookupField({
  segmentName,
  onSegmentNameChange,
  onSearch,
  loading,
  error,
  disabled = false,
}) {
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
          disabled={disabled}
          placeholder="Ej. Clientes_LV_Activos_90d (nombre exacto de la lista en HubSpot)"
          className="flex-1 rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-teal focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={loading || disabled}
          className="whitespace-nowrap rounded-lg bg-brand-indigo px-4 py-2 text-sm font-medium text-white hover:bg-brand-indigo/90 disabled:opacity-50"
        >
          {loading ? 'Buscando en HubSpot + Metabase...' : 'Buscar'}
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-state-danger">{error}</p> : null}
      <p className="mt-1 text-xs italic text-ink-400">
        Conversiones y ventas: reales, vía HubSpot + Metabase (Hermes). Requiere haber elegido la
        fecha de envío arriba.
      </p>
    </div>
  );
}

import SegmentLookupField from './SegmentLookupField.jsx';
import { round2 } from '../../utils/format.js';

// Hefesto — formulario de "Nueva Campaña" de la Calculadora.
//
// PIVOTE DE FASE 2.1 (ver ADR 0008): "Nombre de la campaña" pasa de texto
// libre a un <select> poblado con las campañas que Éter agrupó del CSV
// de Workingbits (cargado en /upload). Elegir una campaña autocompleta
// fecha, mensaje y tipo de evento; el tamaño de muestra del Grupo SMS es
// un campo ReadOnly ("Tamaño de muestra real (Entregados)") tomado de
// `muestra_entregados`, y nunca vuelve a ser editable.
//
// CORRECCIÓN DE FASE 2.2 (ver ADR 0009): el campo "Nombre exacto de la
// lista en HubSpot" + botón "Buscar" (SegmentLookupField) VUELVEN para el
// Grupo SMS — el CSV solo trae teléfonos, pero el cruce contra Metabase
// también necesita los emails de esa lista de HubSpot (ver
// useCampaignCalculator.searchSmsGroup). El Grupo Control sigue usando el
// mismo componente, sin cambios.
//
// REFINAMIENTO FASE 2.3 ("AUTOMATIZACIÓN DE CSV"): "País" y "Fecha de
// envío" pasan a ser ReadOnly, igual que "Tamaño de muestra real" — ya no
// se eligen/editan a mano. Ambos se autocompletan al elegir una campaña
// (ver useCampaignCalculator.selectProcessedCampaign): el país viene de
// la detección automática que Éter hizo en /upload
// (detectCountryFromCsv.js) y la fecha viene de `Communication Start
// Date` del CSV. Bloquearlos garantiza que lo que se ve en el formulario
// es EXACTAMENTE lo que se usa para consultar Metabase — el usuario ya
// no puede desalinear esos dos valores sin querer.
export default function CampaignForm({ calc }) {
  const {
    form,
    setField,
    setEventType,
    country,
    countriesLoading,
    eventTypes,
    processedCampaigns,
    processedCampaignsLoading,
    selectedProcessedCampaign,
    selectProcessedCampaign,
    smsSearch,
    ctrlSearch,
    searchSmsGroup,
    searchControlGroup,
    calculate,
  } = calc;

  const messageLength = form.message.length;
  const smsSegments = Math.max(1, Math.ceil(messageLength / 160) || 1);
  const phoneCount = selectedProcessedCampaign?.telefonos_validos?.length ?? 0;

  return (
    <div className="rounded-card bg-card p-6 shadow-card">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Datos de la campaña
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Nombre de la campaña"
          hint={
            processedCampaignsLoading
              ? 'Cargando campañas del CSV...'
              : processedCampaigns.length === 0
              ? 'No hay campañas cargadas todavía — sube un CSV en /upload.'
              : undefined
          }
        >
          <select
            value={form.processedCampaignId}
            onChange={(e) => selectProcessedCampaign(e.target.value)}
            disabled={processedCampaignsLoading || processedCampaigns.length === 0}
            className="w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-teal focus:outline-none disabled:opacity-50"
          >
            <option value="">
              {processedCampaignsLoading ? 'Cargando...' : 'Selecciona una campaña del CSV...'}
            </option>
            {processedCampaigns.map((pc) => (
              <option key={pc.id} value={pc.id}>
                {pc.campaign_name} ({pc.muestra_entregados} entregados)
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fecha de envío" hint={'Se toma de "Communication Start Date" del CSV — no editable, para mantener consistencia con la consulta a Metabase.'}>
          <input
            type="date"
            value={form.sendDate}
            readOnly
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-ink-300/60 bg-ink-100/60 px-3 py-2 text-sm text-ink-700"
          />
        </Field>

        <Field label="País" hint="Detectado automáticamente desde el CSV al elegir la campaña.">
          <input
            type="text"
            value={
              countriesLoading
                ? 'Cargando países...'
                : form.processedCampaignId
                ? `${country.label} - $${country.costPerSms.toFixed(3)} / SMS`
                : 'Elige una campaña arriba'
            }
            readOnly
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-ink-300/60 bg-ink-100/60 px-3 py-2 text-sm text-ink-700"
          />
        </Field>

        <Field label="Tipo de evento" hint="Se auto-completa leyendo el nombre de la campaña; puedes cambiarlo a mano.">
          <select
            value={form.eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-teal focus:outline-none"
          >
            {eventTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <label className="block text-xs font-medium text-ink-500">Mensaje SMS enviado</label>
          <span className="text-xs text-ink-400">
            {messageLength} caracteres · {smsSegments} SMS
          </span>
        </div>
        <textarea
          value={form.message}
          onChange={(e) => setField('message', e.target.value)}
          rows={3}
          placeholder="Se autocompleta al elegir una campaña del CSV..."
          className="mt-1 w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-teal focus:outline-none"
        />
      </div>

      <div className="mt-6 border-t border-ink-300/40 pt-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Grupo SMS</h3>
        <p className="mb-2 text-xs text-ink-400">
          {selectedProcessedCampaign
            ? `${phoneCount} teléfonos entregados del CSV listos para cruzar (junto con los emails de la lista de HubSpot) contra Metabase.`
            : 'Elige primero una campaña arriba.'}
        </p>
        <SegmentLookupField
          segmentName={form.smsSegmentName}
          onSegmentNameChange={(v) => setField('smsSegmentName', v)}
          onSearch={searchSmsGroup}
          loading={smsSearch.loading}
          error={smsSearch.error}
          disabled={!selectedProcessedCampaign}
        />
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <ReadOnlyField label="Tamaño de muestra real (Entregados)" value={form.smsN} />
          <NumberField label="Conversiones SMS" value={form.smsC} onChange={(v) => setField('smsC', v)} />
          <NumberField label="Total ventas SMS (USD)" value={form.smsS} onChange={(v) => setField('smsS', v)} step="0.01" />
        </div>
      </div>

      <GroupSection
        title="Grupo Control"
        segmentName={form.ctrlSegmentName}
        onSegmentNameChange={(v) => setField('ctrlSegmentName', v)}
        onSearch={searchControlGroup}
        search={ctrlSearch}
        sampleLabel="Tamaño de muestra (Control)"
        sampleValue={form.ctrlN}
        onSampleChange={(v) => setField('ctrlN', v)}
        convLabel="Conversiones Control"
        convValue={form.ctrlC}
        onConvChange={(v) => setField('ctrlC', v)}
        salesLabel="Total ventas Control (USD)"
        salesValue={form.ctrlS}
        onSalesChange={(v) => setField('ctrlS', v)}
      />

      <button
        type="button"
        onClick={calculate}
        className="mt-6 w-full rounded-lg bg-sidebar-to px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
      >
        Calcular
      </button>
      <p className="mt-2 text-center text-xs text-ink-400">
        Tarifa aplicada: {country.label} — ${country.costPerSms.toFixed(3)} / SMS. El cálculo es solo en
        memoria; nada se guarda hasta que apruebes el reporte.
      </p>
    </div>
  );
}

function GroupSection({
  title, segmentName, onSegmentNameChange, onSearch, search,
  sampleLabel, sampleValue, onSampleChange,
  convLabel, convValue, onConvChange,
  salesLabel, salesValue, onSalesChange,
}) {
  return (
    <div className="mt-6 border-t border-ink-300/40 pt-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</h3>
      <SegmentLookupField
        segmentName={segmentName}
        onSegmentNameChange={onSegmentNameChange}
        onSearch={onSearch}
        loading={search.loading}
        error={search.error}
      />
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
        <NumberField label={sampleLabel} value={sampleValue} onChange={onSampleChange} />
        <NumberField label={convLabel} value={convValue} onChange={onConvChange} />
        <NumberField label={salesLabel} value={salesValue} onChange={onSalesChange} step="0.01" />
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <Field label={label}>
      <input
        type="text"
        value={value || '0'}
        readOnly
        disabled
        className="w-full cursor-not-allowed rounded-lg border border-ink-300/60 bg-ink-100/60 px-3 py-2 text-sm text-ink-700"
      />
    </Field>
  );
}

function NumberField({ label, value, onChange, step = '1' }) {
  // Campos de dinero (step="0.01"): al perder foco, se redondean a 2
  // decimales — cubre el caso de un valor pegado/editado a mano con más
  // decimales de la cuenta (ver "Corrección de Decimales", format.js).
  const isMoney = step === '0.01';
  function handleBlur(e) {
    if (!isMoney) return;
    const rounded = round2(e.target.value);
    if (String(rounded) !== e.target.value) onChange(String(rounded));
  }
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        className="w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-teal focus:outline-none"
      />
    </Field>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-500">{label}</label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

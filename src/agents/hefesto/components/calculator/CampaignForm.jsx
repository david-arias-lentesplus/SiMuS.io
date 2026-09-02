import SegmentLookupField from './SegmentLookupField.jsx';
import { round2 } from '../../utils/format.js';

// Hefesto — formulario de "Nueva Campaña" de la Calculadora Híbrida
// (pivote de Fase 1, sesión 2026-09-02: ingreso manual + simulación de
// búsqueda de segmentos, ya que la integración directa con Workingbits
// está bloqueada). Componente presentacional puro: recibe todo su estado
// y handlers desde useCampaignCalculator (Minerva) vía la prop `calc`.
//
// Fase 3 (2026-09-02, ADR 0007): `countries` ahora puede venir vacío
// mientras useCountriesConfig (Deméter) carga desde Supabase — el
// <select> lo maneja mostrando "Cargando países..."; y los campos de
// dinero (step="0.01") redondean a 2 decimales en onBlur (ver
// "Corrección de Decimales" en format.js/round2).
export default function CampaignForm({ calc }) {
  const {
    form,
    setField,
    setEventType,
    country,
    countries,
    countriesLoading,
    eventTypes,
    smsSearch,
    ctrlSearch,
    searchSegment,
    calculate,
  } = calc;

  const messageLength = form.message.length;
  const smsSegments = Math.max(1, Math.ceil(messageLength / 160) || 1);

  return (
    <div className="rounded-card bg-card p-6 shadow-card">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Datos de la campaña
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nombre de la campaña">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="LV_CampañaRefuerzoJunio_250626"
            className="w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-teal focus:outline-none"
          />
        </Field>

        <Field label="Fecha de envío">
          <input
            type="date"
            value={form.sendDate}
            onChange={(e) => setField('sendDate', e.target.value)}
            className="w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-teal focus:outline-none"
          />
        </Field>

        <Field label="País">
          <select
            value={form.countryValue}
            onChange={(e) => setField('countryValue', e.target.value)}
            disabled={countriesLoading || countries.length === 0}
            className="w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-teal focus:outline-none disabled:opacity-50"
          >
            {countriesLoading ? (
              <option value="">Cargando países...</option>
            ) : countries.length === 0 ? (
              <option value="">Sin países configurados</option>
            ) : (
              countries.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} - ${c.costPerSms.toFixed(3)} / SMS
                </option>
              ))
            )}
          </select>
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
          placeholder="Escribe el copy del mensaje enviado..."
          className="mt-1 w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-teal focus:outline-none"
        />
      </div>

      <GroupSection
        title="Grupo SMS"
        segmentName={form.smsSegmentName}
        onSegmentNameChange={(v) => setField('smsSegmentName', v)}
        onSearch={() => searchSegment('sms')}
        search={smsSearch}
        sampleLabel="Tamaño de muestra (SMS)"
        sampleValue={form.smsN}
        onSampleChange={(v) => setField('smsN', v)}
        convLabel="Conversiones SMS"
        convValue={form.smsC}
        onConvChange={(v) => setField('smsC', v)}
        salesLabel="Total ventas SMS (USD)"
        salesValue={form.smsS}
        onSalesChange={(v) => setField('smsS', v)}
      />

      <GroupSection
        title="Grupo Control"
        segmentName={form.ctrlSegmentName}
        onSegmentNameChange={(v) => setField('ctrlSegmentName', v)}
        onSearch={() => searchSegment('control')}
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

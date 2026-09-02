import { useState } from 'react';
import SettingsLayout from './SettingsLayout.jsx';
import { useCountriesConfig } from '../../../demeter/hooks/useCountriesConfig.js';
import { fmt$ } from '../../utils/format.js';

// Hefesto — /settings/countries (Fase 3, ADR 0007). CRUD del catálogo de
// países/tarifas que reemplaza el arreglo estático COUNTRIES; consume
// directo el hook de Deméter (useCountriesConfig) sin capa de Minerva de
// por medio porque no hay estado global/filtros involucrados, solo un
// formulario CRUD simple — mismo patrón que /settings/users.
const EMPTY_DRAFT = { countryName: '', smsPrice: '', currency: 'USD', metabaseCode: '', isActive: true };
const INPUT_CLASS =
  'w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-teal focus:outline-none';

export default function CountriesSettingsPage() {
  const { countries, loading, error, create, update, remove } = useCountriesConfig();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  function startEdit(c) {
    setEditingId(c.id);
    setFormError(null);
    setDraft({
      countryName: c.country_name,
      smsPrice: String(c.sms_price),
      currency: c.currency,
      metabaseCode: c.metabase_code,
      isActive: c.is_active,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!draft.countryName.trim() || !draft.metabaseCode.trim() || draft.smsPrice === '') {
      setFormError('País, código de Metabase y precio son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await update(editingId, draft);
      } else {
        await create(draft);
      }
      cancelEdit();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c) {
    if (!window.confirm(`¿Eliminar "${c.country_name}" del catálogo de tarifas?`)) return;
    try {
      await remove(c.id);
    } catch (err) {
      window.alert('Error al eliminar: ' + err.message);
    }
  }

  return (
    <SettingsLayout title="Configuración — Países">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-card bg-card p-6 shadow-card lg:col-span-2">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Catálogo de países y tarifas
          </h2>
          {error ? (
            <p className="text-sm text-state-danger">Error al cargar países: {error.message}</p>
          ) : loading ? (
            <p className="text-sm text-ink-400">Cargando...</p>
          ) : countries.length === 0 ? (
            <p className="text-sm text-ink-400">Todavía no hay países configurados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-300/40 text-xs uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-3">País</th>
                    <th className="py-2 pr-3">Código Metabase</th>
                    <th className="py-2 pr-3">Precio / SMS</th>
                    <th className="py-2 pr-3">Activo</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {countries.map((c) => (
                    <tr key={c.id} className="border-b border-ink-300/20 last:border-0">
                      <td className="py-2 pr-3 font-medium text-ink-900">{c.country_name}</td>
                      <td className="py-2 pr-3">
                        <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-700">
                          {c.metabase_code}
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {fmt$(c.sms_price)} {c.currency}
                      </td>
                      <td className="py-2 pr-3">
                        {c.is_active ? (
                          <span className="text-xs text-state-success">Sí</span>
                        ) : (
                          <span className="text-xs text-ink-400">No</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="mr-2 rounded-lg px-2 py-1 text-xs text-blue-deep hover:bg-blue-deep/10"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="rounded-lg px-2 py-1 text-xs text-state-danger hover:bg-state-danger/10"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="h-fit rounded-card bg-card p-6 shadow-card">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-500">
            {editingId ? 'Editar país' : 'Nuevo país'}
          </h2>
          <div className="space-y-3">
            <SettingsField label="Nombre del país">
              <input
                type="text"
                value={draft.countryName}
                onChange={(e) => setDraft((d) => ({ ...d, countryName: e.target.value }))}
                className={INPUT_CLASS}
                placeholder="Colombia"
              />
            </SettingsField>
            <SettingsField label="Código Metabase (business_unit)" hint="Valor exacto de silver.sales.business_unit">
              <input
                type="text"
                value={draft.metabaseCode}
                onChange={(e) => setDraft((d) => ({ ...d, metabaseCode: e.target.value.toUpperCase() }))}
                className={INPUT_CLASS}
                placeholder="CO"
              />
            </SettingsField>
            <SettingsField label="Precio por SMS">
              <input
                type="number"
                min="0"
                step="0.001"
                value={draft.smsPrice}
                onChange={(e) => setDraft((d) => ({ ...d, smsPrice: e.target.value }))}
                className={INPUT_CLASS}
              />
            </SettingsField>
            <SettingsField label="Moneda">
              <input
                type="text"
                value={draft.currency}
                onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value.toUpperCase() }))}
                className={INPUT_CLASS}
                placeholder="USD"
              />
            </SettingsField>
            <label className="flex items-center gap-2 text-xs text-ink-700">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
              />
              Activo (visible en la Calculadora)
            </label>
          </div>

          {formError ? <p className="mt-3 text-xs text-state-danger">{formError}</p> : null}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-deep px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar país'}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-ink-300/60 px-4 py-2.5 text-sm text-ink-700 hover:bg-surface"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </SettingsLayout>
  );
}

function SettingsField({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-500">{label}</label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

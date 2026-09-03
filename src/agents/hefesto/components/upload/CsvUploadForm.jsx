import { useState } from 'react';
import Papa from 'papaparse';
import { parseWorkingbitsCsv } from '../../../eter/utils/parseWorkingbitsCsv.js';
import { COUNTRIES } from '../../../minerva/constants/countries.js';
import { useProcessedCampaigns } from '../../../demeter/hooks/useProcessedCampaigns.js';

// Hefesto — formulario de /upload (pivote de Fase 2.1, ver ADR 0008):
// el usuario elige el País y sube el CSV que exporta Workingbits. La
// lectura del archivo (PapaParse) y el ensamblado de la UI son de
// Hefesto; TODA la lógica de agrupar/limpiar los datos vive en Éter
// (parseWorkingbitsCsv) — este componente nunca decide por su cuenta qué
// es "Delivered" ni cómo se limpia un teléfono, solo llama a esa función
// y muestra el resultado.
//
// Nota de diseño (por qué el país usa el catálogo ESTÁTICO
// src/agents/minerva/constants/countries.js y no countries_config de
// Supabase): el mapeo de indicativo telefónico por país
// (src/agents/eter/utils/countryDialCodes.js) está definido para los 6
// `value` fijos de ese catálogo. Si /settings/countries llegara a
// agregar un país nuevo, esta pantalla no sabría su indicativo — ver
// "Pendiente de definir" en .claude/agents/eter.md.
export default function CsvUploadForm() {
  const [countryValue, setCountryValue] = useState(COUNTRIES[0]?.value ?? '');
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState({ state: 'idle', error: null }); // idle|parsing|saving|done|error
  const [preview, setPreview] = useState([]); // resultado de Éter, para mostrar el resumen antes/después de guardar

  const { save } = useProcessedCampaigns();

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview([]);
    setStatus({ state: 'parsing', error: null });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const groups = parseWorkingbitsCsv(results.data, countryValue);
          if (groups.length === 0) {
            setStatus({ state: 'error', error: 'El CSV no tiene filas con "Communication Name" reconocible.' });
            return;
          }
          setPreview(groups);
          setStatus({ state: 'saving', error: null });
          await save(groups, countryValue);
          setStatus({ state: 'done', error: null });
        } catch (err) {
          setStatus({ state: 'error', error: err.message || 'Error al procesar el CSV.' });
        }
      },
      error: (err) => {
        setStatus({ state: 'error', error: err.message || 'Error al leer el archivo.' });
      },
    });
  }

  return (
    <div className="rounded-card bg-card p-6 shadow-card">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Cargar CSV de Workingbits
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-ink-500">País</label>
          <select
            value={countryValue}
            onChange={(e) => setCountryValue(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-teal focus:outline-none"
          >
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-400">
            Se usa para quitar el indicativo de país de los teléfonos (ej. "57" para Colombia).
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-500">Archivo CSV</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="mt-1 w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 file:mr-3 file:rounded-md file:border-0 file:bg-brand-indigo file:px-3 file:py-1.5 file:text-white"
          />
          {fileName ? <p className="mt-1 text-xs text-ink-400">Archivo: {fileName}</p> : null}
        </div>
      </div>

      <StatusBanner status={status} groupCount={preview.length} />

      {preview.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-ink-500">
                <th className="py-1 pr-3">Campaña</th>
                <th className="py-1 pr-3">Fecha (CSV)</th>
                <th className="py-1 pr-3">Filas totales</th>
                <th className="py-1 pr-3">Entregados</th>
                <th className="py-1 pr-3">Teléfonos válidos</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((g) => (
                <tr key={g.campaignName} className="border-t border-ink-300/30 text-ink-700">
                  <td className="py-1 pr-3">{g.campaignName}</td>
                  <td className="py-1 pr-3">{g.fecha || '—'}</td>
                  <td className="py-1 pr-3">{g.totalRows}</td>
                  <td className="py-1 pr-3">{g.muestraEntregados}</td>
                  <td className="py-1 pr-3">{g.telefonosValidos.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function StatusBanner({ status, groupCount }) {
  if (status.state === 'idle') return null;
  if (status.state === 'parsing') {
    return <p className="mt-4 text-xs text-ink-500">Leyendo y agrupando el CSV...</p>;
  }
  if (status.state === 'saving') {
    return <p className="mt-4 text-xs text-ink-500">Guardando {groupCount} campaña(s) en Supabase...</p>;
  }
  if (status.state === 'done') {
    return (
      <p className="mt-4 text-xs font-medium text-state-success">
        {groupCount} campaña(s) guardadas. Ya están disponibles en el <em>Nombre de la campaña</em> de la Calculadora.
      </p>
    );
  }
  if (status.state === 'error') {
    return <p className="mt-4 text-xs text-state-danger">{status.error}</p>;
  }
  return null;
}

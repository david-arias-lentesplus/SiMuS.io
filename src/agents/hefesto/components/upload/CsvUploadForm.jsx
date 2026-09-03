import { useState } from 'react';
import Papa from 'papaparse';
import { parseWorkingbitsCsv } from '../../../eter/utils/parseWorkingbitsCsv.js';
import { detectCountryFromCsv, manualSelectionOptions } from '../../../eter/utils/detectCountryFromCsv.js';
import { COUNTRIES } from '../../../minerva/constants/countries.js';
import { useProcessedCampaigns } from '../../../demeter/hooks/useProcessedCampaigns.js';

// Hefesto — formulario de /upload.
//
// PIVOTE DE FASE 2.1 (ver ADR 0008): el usuario elegía el País a mano y
// subía el CSV que exporta Workingbits. La lectura del archivo
// (PapaParse) y el ensamblado de la UI son de Hefesto; TODA la lógica de
// agrupar/limpiar los datos vive en Éter (parseWorkingbitsCsv) — este
// componente nunca decide por su cuenta qué es "Delivered" ni cómo se
// limpia un teléfono, solo llama a esa función y muestra el resultado.
//
// REFINAMIENTO FASE 2.3 ("AUTOMATIZACIÓN DE CSV"): el <select> manual de
// país se ELIMINA. Al soltar el CSV, se corre primero
// `detectCountryFromCsv()` (Éter) sobre las filas ya parseadas — lee la
// columna `Country Name` de la primera fila y, para el caso especial de
// Brasil (dos tiendas: "Brasil NL" y "Brasil LV"), inspecciona el
// prefijo (`NL_`/`LV_`) de `Communication Name`. Si la detección es
// inequívoca, se sigue directo a `parseWorkingbitsCsv` + guardar, sin
// intervención humana. Si NO se puede resolver (Brasil sin prefijo
// reconocible, o un `Country Name` que no coincide con ningún país
// conocido), se muestra un modal pidiendo confirmación manual antes de
// continuar — nunca se asigna un país adivinado sin que el usuario lo
// confirme.
export default function CsvUploadForm() {
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState({ state: 'idle', error: null }); // idle|detecting|parsing|saving|done|error
  const [preview, setPreview] = useState([]); // resultado de Éter, para mostrar el resumen antes/después de guardar
  const [detectedCountry, setDetectedCountry] = useState(null); // resultado de detectCountryFromCsv, para mostrar qué país se detectó
  const [pendingConfirmation, setPendingConfirmation] = useState(null); // { rows, detection } mientras se espera al usuario en el modal

  const { save } = useProcessedCampaigns();

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview([]);
    setDetectedCountry(null);
    setPendingConfirmation(null);
    setStatus({ state: 'detecting', error: null });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const detection = detectCountryFromCsv(results.data);
        if (detection.needsManualSelection) {
          // No se adivina: se pausa el flujo y se le pide al usuario que
          // confirme el país/tienda antes de procesar nada.
          setPendingConfirmation({ rows: results.data, detection });
          setStatus({ state: 'idle', error: null });
          return;
        }
        setDetectedCountry(detection);
        processRows(results.data, detection.countryValue);
      },
      error: (err) => {
        setStatus({ state: 'error', error: err.message || 'Error al leer el archivo.' });
      },
    });
  }

  async function processRows(rows, countryValue) {
    setStatus({ state: 'parsing', error: null });
    try {
      const groups = parseWorkingbitsCsv(rows, countryValue);
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
  }

  function handleConfirmCountry(countryValue) {
    const { rows, detection } = pendingConfirmation;
    setDetectedCountry({ ...detection, countryValue, needsManualSelection: false, confirmedManually: true });
    setPendingConfirmation(null);
    processRows(rows, countryValue);
  }

  function handleCancelConfirmation() {
    setPendingConfirmation(null);
    setFileName('');
    setStatus({ state: 'idle', error: null });
  }

  const detectedLabel = detectedCountry
    ? COUNTRIES.find((c) => c.value === detectedCountry.countryValue)?.label ?? detectedCountry.countryValue
    : null;

  return (
    <div className="rounded-card bg-card p-6 shadow-card">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Cargar CSV de Workingbits
      </h2>

      <div>
        <label className="block text-xs font-medium text-ink-500">Archivo CSV</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="mt-1 w-full max-w-md rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 file:mr-3 file:rounded-md file:border-0 file:bg-brand-indigo file:px-3 file:py-1.5 file:text-white"
        />
        {fileName ? <p className="mt-1 text-xs text-ink-400">Archivo: {fileName}</p> : null}
        <p className="mt-1 text-xs text-ink-400">
          El país se detecta automáticamente desde la columna "Country Name" del CSV — ya no hace
          falta elegirlo a mano.
        </p>
      </div>

      {detectedLabel ? (
        <p className="mt-3 text-xs font-medium text-brand-indigo">
          País detectado: {detectedLabel}
          {detectedCountry?.confirmedManually ? ' (confirmado a mano)' : ' (automático)'}
        </p>
      ) : null}

      <StatusBanner status={status} groupCount={preview.length} />

      {preview.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-ink-500">
                <th className="py-1 pr-3">Campaña</th>
                <th className="py-1 pr-3">Fecha (Send At)</th>
                <th className="py-1 pr-3">Fecha comunicación</th>
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
                  <td className="py-1 pr-3">{g.fechaComunicacion || '—'}</td>
                  <td className="py-1 pr-3">{g.totalRows}</td>
                  <td className="py-1 pr-3">{g.muestraEntregados}</td>
                  <td className="py-1 pr-3">{g.telefonosValidos.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pendingConfirmation ? (
        <CountryConfirmationModal
          detection={pendingConfirmation.detection}
          onConfirm={handleConfirmCountry}
          onCancel={handleCancelConfirmation}
        />
      ) : null}
    </div>
  );
}

/**
 * Modal de confirmación manual — se muestra SOLO cuando
 * `detectCountryFromCsv` no pudo resolver el país/tienda solo (ver
 * `needsManualSelection` en detectCountryFromCsv.js). Dos casos:
 *   - `reason === 'brazil-ambiguous'`: el Country Name es Brasil/Brazil
 *     pero el prefijo de Communication Name no es `NL_`/`LV_` — se pide
 *     elegir entre las dos tiendas de Brasil únicamente (caso de negocio
 *     explícito pedido por el usuario).
 *   - cualquier otro motivo (`no-country-column` / `unknown-country-name`,
 *     extensión defensiva no pedida explícitamente pero razonable): se
 *     ofrece el catálogo completo de países en vez de fallar en silencio.
 */
function CountryConfirmationModal({ detection, onConfirm, onCancel }) {
  const isBrazilCase = detection.reason === 'brazil-ambiguous';
  const options = isBrazilCase
    ? manualSelectionOptions().filter((c) => c.value === 'brasil-nl' || c.value === 'brasil-lv')
    : manualSelectionOptions();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-card bg-card p-6 shadow-card">
        <h3 className="text-sm font-semibold text-ink-900">No se pudo detectar el país automáticamente</h3>
        {isBrazilCase ? (
          <p className="mt-2 text-xs text-ink-500">
            El CSV dice "{detection.rawCountryName}", pero el nombre de la comunicación
            {detection.communicationName ? ` ("${detection.communicationName}")` : ''} no empieza con
            "NL_" ni "LV_". Confirma a qué tienda de Brasil pertenece este archivo:
          </p>
        ) : (
          <p className="mt-2 text-xs text-ink-500">
            {detection.rawCountryName
              ? `El CSV dice "${detection.rawCountryName}", pero no coincide con ningún país conocido.`
              : 'El CSV no tiene una columna "Country Name" reconocible.'}{' '}
            Elige el país correcto para continuar:
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {options.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onConfirm(c.value)}
              className="rounded-lg border border-ink-300/60 px-3 py-2 text-left text-sm text-ink-900 hover:border-brand-teal"
            >
              {c.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 text-xs text-ink-400 hover:text-ink-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function StatusBanner({ status, groupCount }) {
  if (status.state === 'idle') return null;
  if (status.state === 'detecting') {
    return <p className="mt-4 text-xs text-ink-500">Detectando país desde el CSV...</p>;
  }
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

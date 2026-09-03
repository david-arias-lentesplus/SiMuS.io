import { useState } from 'react';
import Papa from 'papaparse';
import { parseWorkingbitsCsv } from '../../../eter/utils/parseWorkingbitsCsv.js';
import { detectCountryFromCsv, manualSelectionOptions, BRAZIL_HINT } from '../../../eter/utils/detectCountryFromCsv.js';
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
// columna `Country Name` de la primera fila. Si no se puede resolver
// (Country Name desconocido o ausente), se muestra un modal PRE-parseo
// pidiendo elegir el país de una lista completa.
//
// CORRECCIÓN FASE 2.4 ("DEBUGGING DE UI Y PARSEO DE DATOS"): el caso de
// Brasil (dos tiendas: "Brasil NL" y "Brasil LV") YA NO se resuelve acá
// ni de una sola vez para todo el archivo — eso era el bug reportado
// ("está asignando brasil-lv a campañas que claramente empiezan por
// NL_"). Ahora `detectCountryFromCsv` solo confirma que el archivo es de
// Brasil (hint genérico `BRAZIL_HINT`) y `parseWorkingbitsCsv` resuelve
// NL/LV POR CADA GRUPO usando su propio `Communication Name`. Si algún
// grupo puntual no tiene un prefijo reconocible, se muestra un modal
// POST-parseo pidiendo confirmar la tienda SOLO para esos grupos
// ambiguos — los que sí se resolvieron por su propio prefijo no se
// tocan.
export default function CsvUploadForm() {
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState({ state: 'idle', error: null }); // idle|detecting|parsing|saving|done|error
  const [preview, setPreview] = useState([]); // resultado de Éter, para mostrar el resumen antes/después de guardar
  const [detectedLabel, setDetectedLabel] = useState(''); // texto informativo de qué se detectó, para mostrar arriba del preview

  // Modal PRE-parseo: Country Name desconocido/ausente — hace falta el país completo para poder
  // siquiera limpiar los teléfonos (indicativo). Guarda las filas crudas hasta que el usuario elige.
  const [preParseConfirmation, setPreParseConfirmation] = useState(null); // { rows }

  // Modal POST-parseo: el archivo es de Brasil pero uno o más grupos no tienen prefijo NL_/LV_
  // reconocible en su Communication Name. Guarda los grupos YA parseados (los resueltos quedan
  // intactos) hasta que el usuario confirma la tienda para los ambiguos.
  const [postParseConfirmation, setPostParseConfirmation] = useState(null); // { groups, unresolvedNames }

  const { save } = useProcessedCampaigns();

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview([]);
    setDetectedLabel('');
    setPreParseConfirmation(null);
    setPostParseConfirmation(null);
    setStatus({ state: 'detecting', error: null });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const detection = detectCountryFromCsv(results.data);
        if (detection.needsManualSelection) {
          setPreParseConfirmation({ rows: results.data });
          setStatus({ state: 'idle', error: null });
          return;
        }
        runParse(results.data, detection.countryValue, detection.countryValue === BRAZIL_HINT ? 'Brasil (detectando tienda por campaña...)' : undefined);
      },
      error: (err) => {
        setStatus({ state: 'error', error: err.message || 'Error al leer el archivo.' });
      },
    });
  }

  /** Corre parseWorkingbitsCsv con el hint de país/tienda ya resuelto (o BRAZIL_HINT). */
  function runParse(rows, countryHint, labelOverride) {
    setStatus({ state: 'parsing', error: null });
    try {
      const groups = parseWorkingbitsCsv(rows, countryHint);
      if (groups.length === 0) {
        setStatus({ state: 'error', error: 'El CSV no tiene filas con "Communication Name" reconocible.' });
        return;
      }

      const unresolved = groups.filter((g) => !g.countryValue);
      if (unresolved.length > 0) {
        // Caso de Brasil ambiguo (Fase 2.4): uno o más grupos no tienen
        // prefijo NL_/LV_ reconocible — se pausa y se pide confirmar SOLO
        // la tienda por defecto para esos grupos puntuales.
        setPostParseConfirmation({ groups, unresolvedNames: unresolved.map((g) => g.campaignName) });
        setStatus({ state: 'idle', error: null });
        return;
      }

      finishAndSave(groups, countryHint);
    } catch (err) {
      setStatus({ state: 'error', error: err.message || 'Error al procesar el CSV.' });
    }
  }

  async function finishAndSave(groups, countryHint) {
    setDetectedLabel(describeDetection(groups, countryHint));
    setPreview(groups);
    setStatus({ state: 'saving', error: null });
    try {
      await save(groups);
      setStatus({ state: 'done', error: null });
    } catch (err) {
      setStatus({ state: 'error', error: err.message || 'Error al guardar en Supabase.' });
    }
  }

  function handlePreParseConfirm(countryValue) {
    const { rows } = preParseConfirmation;
    setPreParseConfirmation(null);
    runParse(rows, countryValue);
  }

  function handlePreParseCancel() {
    setPreParseConfirmation(null);
    setFileName('');
    setStatus({ state: 'idle', error: null });
  }

  function handlePostParseConfirm(defaultStoreValue) {
    const { groups } = postParseConfirmation;
    const resolvedGroups = groups.map((g) => (g.countryValue ? g : { ...g, countryValue: defaultStoreValue }));
    setPostParseConfirmation(null);
    finishAndSave(resolvedGroups, BRAZIL_HINT);
  }

  function handlePostParseCancel() {
    setPostParseConfirmation(null);
    setFileName('');
    setStatus({ state: 'idle', error: null });
  }

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
        <p className="mt-3 text-xs font-medium text-brand-indigo">{detectedLabel}</p>
      ) : null}

      <StatusBanner status={status} groupCount={preview.length} />

      {preview.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-ink-500">
                <th className="py-1 pr-3">Campaña</th>
                <th className="py-1 pr-3">País/tienda</th>
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
                  <td className="py-1 pr-3">{COUNTRIES.find((c) => c.value === g.countryValue)?.label ?? g.countryValue ?? '—'}</td>
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

      {preParseConfirmation ? (
        <SelectionModal
          title="No se pudo detectar el país automáticamente"
          description={'El CSV no tiene una columna "Country Name" reconocible, o su valor no coincide con ningún país conocido. Elige el país correcto para continuar:'}
          options={manualSelectionOptions()}
          onConfirm={handlePreParseConfirm}
          onCancel={handlePreParseCancel}
        />
      ) : null}

      {postParseConfirmation ? (
        <SelectionModal
          title="Confirma la tienda de Brasil para algunas campañas"
          description={`Estas campañas no empiezan por "NL_" ni "LV_": ${postParseConfirmation.unresolvedNames.join(', ')}. Elige a qué tienda asignarlas (las demás campañas del archivo, que sí tienen el prefijo, no se ven afectadas):`}
          options={manualSelectionOptions().filter((c) => c.value === 'brasil-nl' || c.value === 'brasil-lv')}
          onConfirm={handlePostParseConfirm}
          onCancel={handlePostParseCancel}
        />
      ) : null}
    </div>
  );
}

/** Texto informativo mostrado arriba del preview, resumiendo qué país(es)/tienda(s) resultaron. */
function describeDetection(groups, countryHint) {
  if (countryHint !== BRAZIL_HINT) {
    const label = COUNTRIES.find((c) => c.value === countryHint)?.label ?? countryHint;
    return `País detectado: ${label}`;
  }
  const distinctStores = Array.from(new Set(groups.map((g) => g.countryValue)));
  const labels = distinctStores.map((v) => COUNTRIES.find((c) => c.value === v)?.label ?? v);
  return `Brasil detectado — tiendas por campaña: ${labels.join(', ')}`;
}

/** Modal de selección genérico — usado tanto para el país completo (pre-parseo) como para Brasil NL/LV (post-parseo). */
function SelectionModal({ title, description, options, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-card bg-card p-6 shadow-card">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <p className="mt-2 text-xs text-ink-500">{description}</p>

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

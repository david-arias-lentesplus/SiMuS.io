import { useEffect, useMemo, useState } from 'react';
import { useFilteredCampaigns } from './useFilteredCampaigns.js';
import { COUNTRIES } from '../constants/countries.js';
import { EVENT_TYPES, detectEventType } from '../utils/detectEventType.js';
import { fetchSegmentFromHubSpot } from '../utils/fetchSegmentFromHubSpot.js';
import { simulateConversions } from '../utils/simulateConversions.js';
import { computeMetrics } from '../utils/computeMetrics.js';

// Minerva — hook de "organización" de la Calculadora Híbrida (pivote de
// Fase 1, sesión 2026-09-02; integración real con HubSpot en Fase 2,
// sesión 2026-09-02). Es la única puerta de entrada que
// CalculatorPage.jsx (Hefesto) debe usar: mantiene el estado del
// formulario, orquesta la búsqueda de segmentos (tamaño de muestra REAL
// vía Hermes/HubSpot + conversiones aún simuladas hasta que Iris integre
// Metabase/Workingbits) y separa con claridad las dos acciones del flujo:
//
//   1. calculate()      -> SOLO calcula en memoria (computeMetrics), NUNCA
//                           toca Supabase.
//   2. approveAndSave()  -> únicamente cuando el usuario aprueba
//                           explícitamente el reporte ya calculado, hace el
//                           insert en Supabase vía Deméter
//                           (useFilteredCampaigns().save).
//
// Ver instrucción del usuario en HANDOFF.md, sesión 2026-09-02: "Aprobación
// Explícita".

const EMPTY_FORM = {
  name: '',
  sendDate: '',
  countryValue: COUNTRIES[0].value,
  eventType: EVENT_TYPES[0],
  message: '',
  smsSegmentName: '',
  smsN: '',
  smsC: '',
  smsS: '',
  ctrlSegmentName: '',
  ctrlN: '',
  ctrlC: '',
  ctrlS: '',
};

const IDLE_SEARCH = { loading: false, error: null };
const IDLE_APPROVAL = { status: 'idle', error: null };

export function useCampaignCalculator() {
  const { save } = useFilteredCampaigns();

  const [form, setForm] = useState(EMPTY_FORM);
  const [eventTypeTouched, setEventTypeTouched] = useState(false);
  const [smsSearch, setSmsSearch] = useState(IDLE_SEARCH);
  const [ctrlSearch, setCtrlSearch] = useState(IDLE_SEARCH);
  const [report, setReport] = useState(null); // objeto `m` calculado en memoria
  const [approval, setApproval] = useState(IDLE_APPROVAL); // idle|saving|saved|error

  // Regla reactiva: mientras el usuario no haya tocado el <select> de tipo
  // de evento a mano, se auto-completa leyendo el nombre de campaña.
  useEffect(() => {
    if (eventTypeTouched) return;
    setForm((f) => ({ ...f, eventType: detectEventType(f.name) }));
  }, [form.name, eventTypeTouched]);

  const country = useMemo(
    () => COUNTRIES.find((c) => c.value === form.countryValue) ?? COUNTRIES[0],
    [form.countryValue]
  );

  // Cualquier edición del formulario invalida el último reporte calculado
  // (evita aprobar/guardar un reporte que ya no corresponde a los datos
  // visibles en el formulario).
  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setReport(null);
    setApproval(IDLE_APPROVAL);
  }

  function setEventType(value) {
    setEventTypeTouched(true);
    setField('eventType', value);
  }

  /**
   * Busca el segmento: tamaño de muestra REAL vía Hermes (API Route ->
   * HubSpot, ver .claude/agents/hermes.md, Fase 2) + conversiones
   * simuladas (cruce con Metabase/Workingbits, pendiente de Iris). Listas
   * grandes pueden tardar unos segundos en HubSpot (paginación +
   * batch/read en lotes de 100) — setSearch({loading:true}) queda activo
   * mientras tanto para que Hefesto muestre el estado de carga.
   */
  async function searchSegment(kind) {
    const isSms = kind === 'sms';
    const setSearch = isSms ? setSmsSearch : setCtrlSearch;
    const nameField = isSms ? 'smsSegmentName' : 'ctrlSegmentName';
    const segmentName = form[nameField].trim();

    if (!segmentName) {
      setSearch({ loading: false, error: 'Ingresa el nombre del segmento primero.' });
      return;
    }

    setSearch({ loading: true, error: null });
    try {
      const { sampleSize } = await fetchSegmentFromHubSpot(segmentName);
      const conversions = simulateConversions(segmentName, kind, sampleSize);
      setForm((f) => ({
        ...f,
        ...(isSms
          ? { smsN: String(sampleSize), smsC: String(conversions) }
          : { ctrlN: String(sampleSize), ctrlC: String(conversions) }),
      }));
      setReport(null);
      setApproval(IDLE_APPROVAL);
      setSearch({ loading: false, error: null });
    } catch (e) {
      setSearch({ loading: false, error: e.message });
    }
  }

  /** Calcula el reporte EN MEMORIA. No hace ningún insert en Supabase. */
  function calculate() {
    const m = computeMetrics({
      name: form.name.trim() || 'Campaña sin nombre',
      countryName: country.label,
      smsCost: country.costPerSms,
      sendDate: form.sendDate,
      smsMessage: form.message,
      eventType: form.eventType,
      smsN: Number(form.smsN) || 0,
      smsC: Number(form.smsC) || 0,
      smsS: Number(form.smsS) || 0,
      ctrlN: Number(form.ctrlN) || 0,
      ctrlC: Number(form.ctrlC) || 0,
      ctrlS: Number(form.ctrlS) || 0,
    });
    setReport(m);
    setApproval(IDLE_APPROVAL);
    return m;
  }

  /** Único punto del flujo que efectivamente escribe en Supabase (vía Deméter). */
  async function approveAndSave() {
    if (!report) return;
    setApproval({ status: 'saving', error: null });
    try {
      await save(report);
      setApproval({ status: 'saved', error: null });
    } catch (e) {
      setApproval({ status: 'error', error: e.message });
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEventTypeTouched(false);
    setSmsSearch(IDLE_SEARCH);
    setCtrlSearch(IDLE_SEARCH);
    setReport(null);
    setApproval(IDLE_APPROVAL);
  }

  return {
    form,
    setField,
    setEventType,
    country,
    countries: COUNTRIES,
    eventTypes: EVENT_TYPES,
    smsSearch,
    ctrlSearch,
    searchSegment,
    report,
    calculate,
    approveAndSave,
    approval,
    resetForm,
  };
}

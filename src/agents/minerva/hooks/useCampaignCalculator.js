import { useEffect, useMemo, useState } from 'react';
import { useFilteredCampaigns } from './useFilteredCampaigns.js';
import { useCountriesConfig } from '../../demeter/hooks/useCountriesConfig.js';
import { COUNTRIES as STATIC_COUNTRIES_FALLBACK } from '../constants/countries.js';
import { EVENT_TYPES, detectEventType } from '../utils/detectEventType.js';
import { fetchSegmentFromHubSpot } from '../utils/fetchSegmentFromHubSpot.js';
import { fetchConversionsFromMetabase } from '../utils/fetchConversionsFromMetabase.js';
import { computeMetrics } from '../utils/computeMetrics.js';
import { round2 } from '../../hefesto/utils/format.js';

// Minerva — hook de "organización" de la Calculadora Híbrida (pivote de
// Fase 1, sesión 2026-09-02; integración real con HubSpot en Fase 2;
// cruce real de conversiones contra Metabase en el ajuste de esa misma
// sesión; catálogo de países vía Supabase en Fase 3, ADR 0007). Es la
// única puerta de entrada que CalculatorPage.jsx (Hefesto) debe usar:
// mantiene el estado del formulario, orquesta la búsqueda de segmentos
// (tamaño de muestra REAL vía Hermes/HubSpot + conversiones y ventas
// REALES vía Hermes/Metabase) y separa con claridad las dos acciones del
// flujo:
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
  countryValue: '', // se completa solo con el primer país que cargue useCountriesConfig
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
  // Fase 3 (ADR 0007): fuente de verdad ahora es la tabla countries_config
  // (solo países activos). Si viene vacía (tabla recién migrada sin
  // deploy coordinado, error de red, RLS todavía no aplicado en un
  // entorno viejo) se cae al catálogo estático como red de seguridad,
  // para no dejar la Calculadora inutilizable.
  const { countries: countriesConfig, loading: countriesLoading, error: countriesError } =
    useCountriesConfig({ onlyActive: true });

  const countries = useMemo(() => {
    if (countriesConfig.length > 0) {
      return countriesConfig.map((c) => ({
        value: c.id,
        label: c.country_name,
        costPerSms: Number(c.sms_price),
        businessUnit: c.metabase_code,
      }));
    }
    if (!countriesLoading) return STATIC_COUNTRIES_FALLBACK;
    return [];
  }, [countriesConfig, countriesLoading]);

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

  // Una vez que el catálogo de países carga (o cae al fallback), se
  // completa el <select> con el primero si el usuario todavía no eligió
  // ninguno (mismo patrón que el auto-completado de eventType arriba).
  useEffect(() => {
    if (!form.countryValue && countries.length > 0) {
      setForm((f) => ({ ...f, countryValue: countries[0].value }));
    }
  }, [countries, form.countryValue]);

  const country = useMemo(
    () => countries.find((c) => c.value === form.countryValue) ?? countries[0] ?? { label: '', costPerSms: 0, businessUnit: '' },
    [countries, form.countryValue]
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
   * Busca el segmento y lo cruza contra ventas reales:
   *   1. Tamaño de muestra + contactos (con email) REALES vía Hermes/HubSpot.
   *   2. Conversiones + ventas REALES vía Hermes/Metabase, cruzando esos
   *      emails contra `silver.sales` en la ventana de atribución desde
   *      `form.sendDate`, filtrado por `country.businessUnit` y excluyendo
   *      cancelaciones (ver src/agents/hermes/services/metabaseService.js).
   * Requiere que el usuario ya haya elegido la fecha de envío y el país
   * (el segundo siempre tiene un valor por defecto una vez que
   * useCountriesConfig termina de cargar) — sin fecha de envío no hay
   * ventana de atribución que calcular, así que se valida antes de llamar
   * a HubSpot para no gastar esa consulta en vano.
   * `totalSales` se redondea a 2 decimales (round2) antes de guardarse en
   * el formulario — corrige el bug de QA de Fase 3 donde la suma de
   * lotes de Metabase podía traer basura de punto flotante
   * (13084,510000000002) directo al input editable (ver format.js).
   * Listas grandes pueden tardar unos segundos en HubSpot (paginación +
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
    if (!form.sendDate) {
      setSearch({ loading: false, error: 'Selecciona la fecha de envío antes de buscar el segmento.' });
      return;
    }

    setSearch({ loading: true, error: null });
    try {
      const { sampleSize, contacts } = await fetchSegmentFromHubSpot(segmentName);
      const emails = contacts.map((c) => c.email).filter(Boolean);
      const { conversions, totalSales } = await fetchConversionsFromMetabase({
        emails,
        businessUnit: country.businessUnit,
        sendDate: form.sendDate,
      });
      const cleanTotalSales = round2(totalSales);
      setForm((f) => ({
        ...f,
        ...(isSms
          ? { smsN: String(sampleSize), smsC: String(conversions), smsS: String(cleanTotalSales) }
          : { ctrlN: String(sampleSize), ctrlC: String(conversions), ctrlS: String(cleanTotalSales) }),
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
    countries,
    countriesLoading,
    countriesError,
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

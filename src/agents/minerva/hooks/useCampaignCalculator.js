import { useEffect, useMemo, useState } from 'react';
import { useFilteredCampaigns } from './useFilteredCampaigns.js';
import { useCountriesConfig } from '../../demeter/hooks/useCountriesConfig.js';
import { useProcessedCampaigns } from '../../demeter/hooks/useProcessedCampaigns.js';
import { COUNTRIES as STATIC_COUNTRIES_FALLBACK } from '../constants/countries.js';
import { EVENT_TYPES, detectEventType } from '../utils/detectEventType.js';
import { fetchSegmentFromHubSpot } from '../utils/fetchSegmentFromHubSpot.js';
import { fetchConversionsFromMetabase } from '../utils/fetchConversionsFromMetabase.js';
import { fetchConversionsByPhoneFromMetabase } from '../utils/fetchConversionsByPhoneFromMetabase.js';
import { parseCsvDate } from '../utils/parseCsvDate.js';
import { computeMetrics } from '../utils/computeMetrics.js';
import { round2 } from '../../hefesto/utils/format.js';

// Minerva — hook de "organización" de la Calculadora (pivote de Fase 1,
// sesión 2026-09-02; integración real con HubSpot en Fase 2; cruce real
// de conversiones contra Metabase en esa misma sesión; catálogo de
// países vía Supabase en Fase 3, ADR 0007; PIVOTE DE FASE 2.1 — ver ADR
// 0008 — automatización del Grupo SMS desde el CSV de Workingbits que
// Éter procesó). Es la única puerta de entrada que CalculatorPage.jsx
// (Hefesto) debe usar.
//
// Cambio de Fase 2.1: "Nombre de la campaña" deja de ser texto libre y
// pasa a ser la selección de una campaña ya procesada por Éter (ver
// useProcessedCampaigns, Deméter). Al elegirla se autocompletan fecha,
// mensaje, tipo de evento y el tamaño de muestra REAL del Grupo SMS
// (`muestra_entregados`, ahora un campo ReadOnly — ver CampaignForm.jsx).
// El botón "Buscar" del Grupo SMS ya no consulta HubSpot: cruza
// directamente `telefonos_validos` de la campaña elegida contra Metabase
// (ver fetchConversionsByPhoneFromMetabase.js). El Grupo Control NO
// cambió en este pivote — sigue buscando un segmento de HubSpot por
// nombre, igual que antes (ver ADR 0008 para por qué se dejó así).
//
// Las dos acciones del flujo se mantienen sin cambios:
//   1. calculate()      -> SOLO calcula en memoria (computeMetrics), NUNCA
//                           toca Supabase.
//   2. approveAndSave()  -> únicamente cuando el usuario aprueba
//                           explícitamente el reporte ya calculado, hace el
//                           insert en Supabase vía Deméter.

const EMPTY_FORM = {
  processedCampaignId: '', // id de sms_processed_campaigns elegido en el <select> (Fase 2.1)
  name: '',
  sendDate: '',
  countryValue: '', // se completa solo con el primer país que cargue useCountriesConfig
  eventType: EVENT_TYPES[0],
  message: '',
  smsN: '',   // ahora ReadOnly: viene de muestra_entregados de la campaña elegida
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
  // (solo países activos). Si viene vacía se cae al catálogo estático
  // como red de seguridad, para no dejar la Calculadora inutilizable.
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

  // Fase 2.1: campañas agrupadas por Éter desde el CSV de Workingbits.
  // Se listan todas y se filtran más abajo por país una vez que `country`
  // está resuelto (ver availableProcessedCampaigns) — NOTA:
  // `sms_processed_campaigns.country_value` guarda el `value` del
  // catálogo ESTÁTICO histórico (ej. 'colombia'), no necesariamente el
  // uuid de countries_config, así que el filtro compara contra ambos.
  const { campaigns: processedCampaigns, loading: processedCampaignsLoading } = useProcessedCampaigns();

  const country = useMemo(
    () => countries.find((c) => c.value === form.countryValue) ?? countries[0] ?? { label: '', costPerSms: 0, businessUnit: '' },
    [countries, form.countryValue]
  );

  const availableProcessedCampaigns = useMemo(() => {
    if (!country?.businessUnit) return [];
    const staticValue = STATIC_COUNTRIES_FALLBACK.find((c) => c.businessUnit === country.businessUnit)?.value;
    return processedCampaigns.filter((pc) => pc.country_value === staticValue || pc.country_value === form.countryValue);
  }, [processedCampaigns, country, form.countryValue]);

  const selectedProcessedCampaign = useMemo(
    () => availableProcessedCampaigns.find((pc) => pc.id === form.processedCampaignId) ?? null,
    [availableProcessedCampaigns, form.processedCampaignId]
  );

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
   * Fase 2.1: el usuario elige en un <select> una campaña ya procesada
   * por Éter (en vez de escribir el nombre a mano). Autocompleta fecha,
   * mensaje, tipo de evento y el tamaño de muestra REAL (Entregados) del
   * Grupo SMS. Limpia cualquier búsqueda/reporte anterior porque cambia
   * la campaña de base.
   */
  function selectProcessedCampaign(processedCampaignId) {
    const campaign = availableProcessedCampaigns.find((pc) => pc.id === processedCampaignId);
    if (!campaign) {
      setField('processedCampaignId', '');
      return;
    }
    setEventTypeTouched(false); // vuelve a auto-detectar para la campaña recién elegida
    setForm((f) => ({
      ...f,
      processedCampaignId: campaign.id,
      name: campaign.campaign_name,
      sendDate: parseCsvDate(campaign.send_date),
      message: campaign.message || '',
      eventType: detectEventType(campaign.campaign_name),
      smsN: String(campaign.muestra_entregados ?? 0),
      smsC: '',
      smsS: '',
    }));
    setSmsSearch(IDLE_SEARCH);
    setReport(null);
    setApproval(IDLE_APPROVAL);
  }

  /**
   * Grupo SMS (Fase 2.1): cruza `telefonos_validos` de la campaña elegida
   * directamente contra Metabase — ya NO busca ningún segmento en
   * HubSpot (ver ADR 0008). Requiere campaña elegida + fecha de envío
   * (siempre viene autocompletada al elegir la campaña, pero el usuario
   * puede editarla si el CSV traía una fecha rara — ver parseCsvDate.js).
   */
  async function searchSmsGroup() {
    if (!selectedProcessedCampaign) {
      setSmsSearch({ loading: false, error: 'Elige primero una campaña del CSV cargado en /upload.' });
      return;
    }
    if (!form.sendDate) {
      setSmsSearch({ loading: false, error: 'Selecciona la fecha de envío antes de buscar.' });
      return;
    }

    setSmsSearch({ loading: true, error: null });
    try {
      const { conversions, totalSales } = await fetchConversionsByPhoneFromMetabase({
        phones: selectedProcessedCampaign.telefonos_validos ?? [],
        businessUnit: country.businessUnit,
        sendDate: form.sendDate,
      });
      setForm((f) => ({ ...f, smsC: String(conversions), smsS: String(round2(totalSales)) }));
      setReport(null);
      setApproval(IDLE_APPROVAL);
      setSmsSearch({ loading: false, error: null });
    } catch (e) {
      setSmsSearch({ loading: false, error: e.message });
    }
  }

  /**
   * Grupo Control (sin cambios en el pivote de Fase 2.1): sigue buscando
   * el tamaño de muestra REAL vía Hermes/HubSpot y el cruce de
   * conversiones/ventas vía Hermes/Metabase por email — ver ADR 0008.
   */
  async function searchControlGroup() {
    const segmentName = form.ctrlSegmentName.trim();
    if (!segmentName) {
      setCtrlSearch({ loading: false, error: 'Ingresa el nombre del segmento primero.' });
      return;
    }
    if (!form.sendDate) {
      setCtrlSearch({ loading: false, error: 'Selecciona la fecha de envío antes de buscar el segmento.' });
      return;
    }

    setCtrlSearch({ loading: true, error: null });
    try {
      const { sampleSize, contacts } = await fetchSegmentFromHubSpot(segmentName);
      const emails = contacts.map((c) => c.email).filter(Boolean);
      const { conversions, totalSales } = await fetchConversionsFromMetabase({
        emails,
        businessUnit: country.businessUnit,
        sendDate: form.sendDate,
      });
      setForm((f) => ({
        ...f,
        ctrlN: String(sampleSize),
        ctrlC: String(conversions),
        ctrlS: String(round2(totalSales)),
      }));
      setReport(null);
      setApproval(IDLE_APPROVAL);
      setCtrlSearch({ loading: false, error: null });
    } catch (e) {
      setCtrlSearch({ loading: false, error: e.message });
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
    processedCampaigns: availableProcessedCampaigns,
    processedCampaignsLoading,
    selectedProcessedCampaign,
    selectProcessedCampaign,
    smsSearch,
    ctrlSearch,
    searchSmsGroup,
    searchControlGroup,
    report,
    calculate,
    approveAndSave,
    approval,
    resetForm,
  };
}

import { useEffect, useMemo, useState } from 'react';
import { useFilteredCampaigns } from './useFilteredCampaigns.js';
import { useCountriesConfig } from '../../demeter/hooks/useCountriesConfig.js';
import { useProcessedCampaigns } from '../../demeter/hooks/useProcessedCampaigns.js';
import { useEventTypes } from '../../demeter/hooks/useEventTypes.js';
import { useCampaignStore } from '../store/useCampaignStore.js';
import { COUNTRIES as STATIC_COUNTRIES_FALLBACK } from '../constants/countries.js';
import { EVENT_TYPES, detectEventType, mergeEventTypes } from '../utils/detectEventType.js';
import { fetchSegmentFromHubSpot } from '../utils/fetchSegmentFromHubSpot.js';
import { fetchConversionsFromMetabase } from '../utils/fetchConversionsFromMetabase.js';
import { fetchConversionsForSmsGroup } from '../utils/fetchConversionsForSmsGroup.js';
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
//
// Corrección de Fase 2.2 (ver ADR 0009): el pivote de Fase 2.1 había
// quitado por completo la búsqueda de HubSpot del Grupo SMS. El usuario
// corrigió eso — el CSV de Workingbits solo trae teléfonos, pero
// TAMBIÉN se necesitan los emails de esa lista en HubSpot para el mejor
// cruce posible contra Metabase. El campo "Nombre exacto de la lista en
// HubSpot" + botón "Buscar" VUELVEN para el Grupo SMS (además de para el
// Grupo Control, que nunca los perdió): `searchSmsGroup()` ahora busca el
// segmento en HubSpot (`fetchSegmentFromHubSpot`) y cruza sus emails
// JUNTO CON `telefonos_validos` de la campaña elegida vía
// `fetchConversionsForSmsGroup` (Hermes hace `email OR phone` contra
// Metabase). El tamaño de muestra del Grupo SMS SIGUE siendo
// `muestra_entregados` (ReadOnly) — HubSpot en este flujo solo aporta
// emails para el cruce, nunca redefine el tamaño de muestra.
//
// REFINAMIENTO FASE 2.3 (probado y REVERTIDO en parte por Fase 2.4, ver
// abajo): se había invertido el orden de selección — listar TODAS las
// campañas sin filtrar por país y resolver el País automáticamente A
// PARTIR de la campaña elegida, dejándolo ReadOnly. El usuario reportó
// (QA, "CORRECCIÓN FASE 2.4") que esto dejaba el selector de País
// bloqueado/inactivo y mezclaba las campañas de todos los países en un
// solo dropdown larguísimo.
//
// CORRECCIÓN FASE 2.4 ("DEBUGGING DE UI Y PARSEO DE DATOS"): se vuelve al
// orden ORIGINAL — el usuario elige el País PRIMERO (dropdown habilitado
// y seleccionable) y el dropdown de "Nombre de la campaña" se filtra
// (`.filter()`) para mostrar solo las campañas cuyo `country_value`
// coincide con el país elegido (ver `availableProcessedCampaigns`). Esto
// vuelve a depender de que `country_value` esté bien resuelto por
// campaña — lo cual ahora sí es correcto gracias al fix de Brasil NL/LV
// en `parseWorkingbitsCsv.js` (antes de Fase 2.4 ese valor podía estar
// mal asignado para campañas mezcladas en un mismo CSV).
//
// Lo que SÍ se mantiene de Fase 2.3: "Fecha de envío" sigue
// autocompletándose desde `communication_start_date` (con `send_date`
// como fallback para campañas viejas) y sigue ReadOnly — solo "País"
// volvió a ser editable, no la fecha.
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
  smsSegmentName: '', // Fase 2.2: vuelve — nombre de lista de HubSpot para el Grupo SMS
  eventTypeCustom: '', // Fase 2.8: texto libre cuando eventType === 'Otro' (ver EVENT_TYPE_OTHER abajo)
  smsN: '',   // ReadOnly: viene de muestra_entregados de la campaña elegida (nunca de HubSpot)
  smsC: '',
  smsS: '',
  ctrlSegmentName: '',
  ctrlN: '',
  ctrlC: '',
  ctrlS: '',
};

const IDLE_SEARCH = { loading: false, error: null };
const IDLE_APPROVAL = { status: 'idle', error: null };

// Fase 2.8 ("TIPOS DE EVENTO DINÁMICOS"): sentinel del <select> de "Tipo
// de evento" que le dice a CampaignForm.jsx que muestre el
// <input type="text"> de texto libre debajo — NUNCA se guarda tal cual
// en Supabase (ver resolveEventType() abajo).
export const EVENT_TYPE_OTHER = 'Otro';

/** Devuelve el tipo de evento real a usar en computeMetrics()/guardado. */
function resolveEventType(form) {
  if (form.eventType !== EVENT_TYPE_OTHER) return form.eventType;
  return form.eventTypeCustom.trim() || EVENT_TYPE_OTHER;
}

export function useCampaignCalculator() {
  const { save } = useFilteredCampaigns();
  // Fase 3 (ADR 0007): fuente de verdad ahora es la tabla countries_config
  // (solo países activos). Si viene vacía se cae al catálogo estático
  // como red de seguridad, para no dejar la Calculadora inutilizable.
  const { countries: countriesConfig, loading: countriesLoading, error: countriesError } =
    useCountriesConfig({ onlyActive: true });
  // Fase 2.8: catálogo dinámico de "Tipo de evento" — combina EVENT_TYPES
  // (semilla/fallback) con los valores DISTINCT ya guardados en
  // sms_campaigns, más el sentinel "Otro" al final (nunca dentro de
  // mergeEventTypes(), ver ese comentario en detectEventType.js).
  const { eventTypes: dbEventTypes } = useEventTypes();
  const eventTypes = useMemo(() => [...mergeEventTypes(dbEventTypes), EVENT_TYPE_OTHER], [dbEventTypes]);

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
  const { campaigns: allProcessedCampaigns, loading: processedCampaignsLoading } = useProcessedCampaigns();

  // Fase 2.5 ("VISTA DE GESTIÓN DE CAMPAÑAS CARGADAS"): id de
  // sms_processed_campaigns dejado por /campanas-cargadas al pulsar
  // "Calcular ROI" (ver useCampaignStore.js). Se consume una sola vez
  // más abajo, en cuanto el catálogo de países y las campañas ya
  // cargaron.
  const pendingProcessedCampaignId = useCampaignStore((s) => s.pendingProcessedCampaignId);
  const consumePendingProcessedCampaignId = useCampaignStore((s) => s.consumePendingProcessedCampaignId);

  const country = useMemo(
    () => countries.find((c) => c.value === form.countryValue) ?? countries[0] ?? { label: '', costPerSms: 0, businessUnit: '' },
    [countries, form.countryValue]
  );

  // CORRECCIÓN FASE 2.4: filtro restaurado — solo se ofrecen las campañas
  // cuyo `country_value` corresponde al país actualmente elegido en el
  // formulario (comparando contra el `value` estático histórico Y contra
  // `form.countryValue`, por si `countries` viene de countries_config con
  // otro id — mismo puente que ya se usaba antes de Fase 2.3).
  const availableProcessedCampaigns = useMemo(() => {
    if (!country?.businessUnit) return [];
    const staticValue = STATIC_COUNTRIES_FALLBACK.find((c) => c.businessUnit === country.businessUnit)?.value;
    return allProcessedCampaigns.filter((pc) => pc.country_value === staticValue || pc.country_value === form.countryValue);
  }, [allProcessedCampaigns, country, form.countryValue]);

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
   * CORRECCIÓN FASE 2.4: cambiar el País a mano limpia la campaña elegida
   * (si había una) y cualquier búsqueda/reporte anterior — evita quedarse
   * con una campaña de un país distinto seleccionada "a la fuerza" contra
   * la lista ya filtrada del nuevo país.
   */
  function setCountryValue(value) {
    setForm((f) => ({ ...f, countryValue: value, processedCampaignId: '', name: '', sendDate: '', message: '', smsN: '' }));
    setEventTypeTouched(false);
    setSmsSearch(IDLE_SEARCH);
    setReport(null);
    setApproval(IDLE_APPROVAL);
  }

  /**
   * Fase 2.1: el usuario elige en un <select> una campaña ya procesada
   * por Éter (en vez de escribir el nombre a mano). Autocompleta fecha,
   * mensaje, tipo de evento y el tamaño de muestra REAL (Entregados) del
   * Grupo SMS. Limpia cualquier búsqueda/reporte anterior porque cambia
   * la campaña de base.
   *
   * Fase 2.3 / CORRECCIÓN FASE 2.4: "Fecha de envío" se toma de
   * `communication_start_date` (con `send_date` como fallback para
   * campañas cargadas antes de la migración 005) y queda ReadOnly en el
   * formulario (ver CampaignForm.jsx) — el País YA NO se toca acá (Fase
   * 2.4 revirtió eso): el usuario ya lo eligió antes, y la lista de
   * campañas ya viene filtrada por ese país.
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
      sendDate: parseCsvDate(campaign.communication_start_date || campaign.send_date),
      message: campaign.message || '',
      eventType: detectEventType(campaign.campaign_name),
      smsN: String(campaign.muestra_entregados ?? 0),
      smsC: '',
      smsS: '',
      // smsSegmentName NO se limpia a propósito: el nombre de la lista de
      // HubSpot suele ser el mismo entre campañas de un mismo flujo de
      // trabajo (Fase 2.2) — el usuario puede sobreescribirlo a mano.
    }));
    setSmsSearch(IDLE_SEARCH);
    setReport(null);
    setApproval(IDLE_APPROVAL);
  }

  /**
   * Fase 2.5 ("VISTA DE GESTIÓN DE CAMPAÑAS CARGADAS"): si
   * /campanas-cargadas dejó un `pendingProcessedCampaignId` en el store
   * (botón "Calcular ROI"), se busca esa campaña en la lista SIN
   * filtrar por país (`allProcessedCampaigns` — la campaña puede ser de
   * cualquier país, no necesariamente el que esté elegido ahora mismo
   * en el formulario) y se completan país + campaña + fecha/mensaje/tipo
   * de evento/tamaño de muestra en un solo `setForm`, en vez de llamar a
   * `setCountryValue()` seguido de `selectProcessedCampaign()` — esas dos
   * funciones actúan sobre `availableProcessedCampaigns` (ya filtrada
   * por el país ANTERIOR) y sobre el estado de un render anterior, así
   * que encadenarlas acá arrastraría una condición de carrera (el filtro
   * por país nuevo todavía no habría corrido cuando se intenta elegir la
   * campaña). Se resuelve el país de la campaña puenteando por
   * `country_value` igual que hace `availableProcessedCampaigns` arriba
   * (puede venir como el `value` estático histórico o como el id de
   * countries_config).
   */
  useEffect(() => {
    if (!pendingProcessedCampaignId) return;
    if (processedCampaignsLoading || countries.length === 0) return;

    const campaign = allProcessedCampaigns.find((pc) => pc.id === pendingProcessedCampaignId);
    consumePendingProcessedCampaignId(); // se consume una sola vez, exista o no la campaña
    if (!campaign) return;

    const directMatch = countries.find((c) => c.value === campaign.country_value);
    const staticEntry = STATIC_COUNTRIES_FALLBACK.find((c) => c.value === campaign.country_value);
    const bridgedMatch = staticEntry ? countries.find((c) => c.businessUnit === staticEntry.businessUnit) : null;
    const matchedCountry = directMatch ?? bridgedMatch ?? countries[0];

    setEventTypeTouched(false);
    setForm((f) => ({
      ...f,
      countryValue: matchedCountry.value,
      processedCampaignId: campaign.id,
      name: campaign.campaign_name,
      sendDate: parseCsvDate(campaign.communication_start_date || campaign.send_date),
      message: campaign.message || '',
      eventType: detectEventType(campaign.campaign_name),
      smsN: String(campaign.muestra_entregados ?? 0),
      smsC: '',
      smsS: '',
    }));
    setSmsSearch(IDLE_SEARCH);
    setReport(null);
    setApproval(IDLE_APPROVAL);
  }, [pendingProcessedCampaignId, processedCampaignsLoading, allProcessedCampaigns, countries, consumePendingProcessedCampaignId]);

  /**
   * Grupo SMS (corrección de Fase 2.2, ver ADR 0009): busca el segmento
   * de HubSpot que el usuario escribió (mismo mecanismo que el Grupo
   * Control) para obtener sus emails, y los cruza JUNTO CON
   * `telefonos_validos` de la campaña elegida contra Metabase — Hermes
   * hace el match `(email OR phone)` en una sola llamada (ver
   * fetchConversionsForSmsGroup.js). El tamaño de muestra (`smsN`) NO se
   * toca acá: sigue siendo `muestra_entregados`, ReadOnly, tomado al
   * elegir la campaña — HubSpot en este flujo solo aporta emails para el
   * cruce. Requiere campaña elegida + nombre de lista + fecha de envío.
   */
  async function searchSmsGroup() {
    if (!selectedProcessedCampaign) {
      setSmsSearch({ loading: false, error: 'Elige primero una campaña del CSV cargado en /upload.' });
      return;
    }
    const segmentName = form.smsSegmentName.trim();
    if (!segmentName) {
      setSmsSearch({ loading: false, error: 'Ingresa el nombre de la lista de HubSpot primero.' });
      return;
    }
    if (!form.sendDate) {
      setSmsSearch({ loading: false, error: 'Selecciona la fecha de envío antes de buscar.' });
      return;
    }

    setSmsSearch({ loading: true, error: null });
    try {
      const { contacts } = await fetchSegmentFromHubSpot(segmentName);
      const emails = contacts.map((c) => c.email).filter(Boolean);
      const { conversions, totalSales } = await fetchConversionsForSmsGroup({
        emails,
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
      eventType: resolveEventType(form),
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
    setCountryValue,
    setEventType,
    country,
    countries,
    countriesLoading,
    countriesError,
    eventTypes,
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

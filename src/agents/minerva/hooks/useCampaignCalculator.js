import { useEffect, useMemo, useState } from 'react';
import { useFilteredCampaigns } from './useFilteredCampaigns.js';
import { useCountriesConfig } from '../../demeter/hooks/useCountriesConfig.js';
import { useProcessedCampaigns } from '../../demeter/hooks/useProcessedCampaigns.js';
import { COUNTRIES as STATIC_COUNTRIES_FALLBACK } from '../constants/countries.js';
import { EVENT_TYPES, detectEventType } from '../utils/detectEventType.js';
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
// REFINAMIENTO FASE 2.3 ("AUTOMATIZACIÓN DE CSV"): el orden de selección
// se INVIERTE. Antes el usuario elegía el País primero (filtrando qué
// campañas procesadas se ofrecían) y luego la campaña. Desde que /upload
// detecta el país automáticamente del CSV (ver
// eter/utils/detectCountryFromCsv.js) y lo guarda por campaña, ya no
// tiene sentido pedirle al usuario que lo elija de nuevo: ahora se listan
// TODAS las campañas procesadas (sin filtrar por país) y, al elegir una,
// el País se resuelve automáticamente a partir de su `country_value`
// guardado (ver `resolveCountryForProcessedCampaign`) y queda en modo
// ReadOnly en el formulario — igual que "Fecha de envío", que ahora se
// autocompleta desde `communication_start_date` (Éter, migración 005) en
// vez de `send_date`, también ReadOnly, para garantizar que la fecha que
// ve el usuario es EXACTAMENTE la que se usa en la consulta a Metabase.
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
  // REFINAMIENTO FASE 2.3: se listan TODAS sin filtrar por país (ver
  // `availableProcessedCampaigns` más abajo) — el país ya no se elige
  // antes de la campaña, se resuelve DESPUÉS a partir de ella.
  const { campaigns: processedCampaigns, loading: processedCampaignsLoading } = useProcessedCampaigns();

  const country = useMemo(
    () => countries.find((c) => c.value === form.countryValue) ?? countries[0] ?? { label: '', costPerSms: 0, businessUnit: '' },
    [countries, form.countryValue]
  );

  // REFINAMIENTO FASE 2.3: ya NO se filtra por país antes de elegir la
  // campaña (ver nota grande arriba) — se listan TODAS las campañas
  // procesadas, el país se resuelve DESPUÉS a partir de la campaña
  // elegida. Se mantiene el nombre `availableProcessedCampaigns` para no
  // tocar el resto de los consumidores (CampaignForm.jsx).
  const availableProcessedCampaigns = processedCampaigns;

  const selectedProcessedCampaign = useMemo(
    () => availableProcessedCampaigns.find((pc) => pc.id === form.processedCampaignId) ?? null,
    [availableProcessedCampaigns, form.processedCampaignId]
  );

  /**
   * Resuelve la entrada de `countries` (countries_config o el catálogo
   * estático de respaldo) que corresponde al `country_value` que Éter
   * detectó y guardó para esta campaña procesada — ver
   * detectCountryFromCsv.js y migración 003 (`country_value` guarda el
   * `value` del catálogo ESTÁTICO histórico, ej. 'colombia', no
   * necesariamente el uuid de countries_config). Se resuelve puenteando
   * por `businessUnit`, igual que ya hacía el filtro anterior.
   */
  function resolveCountryForProcessedCampaign(campaign) {
    if (!campaign) return null;
    const staticMatch = STATIC_COUNTRIES_FALLBACK.find((c) => c.value === campaign.country_value);
    const businessUnit = staticMatch?.businessUnit;
    if (businessUnit) {
      const match = countries.find((c) => c.businessUnit === businessUnit);
      if (match) return match;
    }
    // Red de seguridad: si por algún motivo country_value ya coincide
    // directamente con un `value` de `countries` (ej. countries_config
    // reusara el mismo string), igual se resuelve.
    return countries.find((c) => c.value === campaign.country_value) ?? null;
  }

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
   *
   * REFINAMIENTO FASE 2.3: además de fecha/mensaje/muestra, ahora también
   * autocompleta y BLOQUEA (ver CampaignForm.jsx) dos campos:
   *   - `countryValue`: resuelto de `country_value` (detectado por Éter
   *     al subir el CSV) vía `resolveCountryForProcessedCampaign` — ya no
   *     lo elige el usuario a mano.
   *   - `sendDate`: ahora se toma de `communication_start_date`
   *     (migración 005), con `send_date` como fallback SOLO para
   *     campañas cargadas antes de esa migración (que no tienen el campo
   *     nuevo) — nunca se deja la fecha vacía si alguna de las dos
   *     columnas tiene un valor utilizable.
   */
  function selectProcessedCampaign(processedCampaignId) {
    const campaign = availableProcessedCampaigns.find((pc) => pc.id === processedCampaignId);
    if (!campaign) {
      setField('processedCampaignId', '');
      return;
    }
    const matchedCountry = resolveCountryForProcessedCampaign(campaign);
    setEventTypeTouched(false); // vuelve a auto-detectar para la campaña recién elegida
    setForm((f) => ({
      ...f,
      processedCampaignId: campaign.id,
      name: campaign.campaign_name,
      sendDate: parseCsvDate(campaign.communication_start_date || campaign.send_date),
      countryValue: matchedCountry ? matchedCountry.value : f.countryValue,
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

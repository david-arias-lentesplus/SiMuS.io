// Minerva — catálogo ESTÁTICO de tarifas de SMS por país/segmento
// tarifario. Fuente: referencia visual del dropdown adjuntada por el
// usuario (pivote de Fase 1, sesión 2026-09-02).
//
// Fase 3 (2026-09-02, "AUTENTICACIÓN, CONFIGURACIÓN Y UI POLISH", ADR
// 0007): este arreglo YA NO es la fuente de verdad que consume la
// Calculadora — esa pasó a la tabla `countries_config` de Supabase,
// editable desde /settings/countries (solo admin) vía
// src/agents/demeter/hooks/useCountriesConfig.js. Este archivo se
// conserva por dos motivos, no como catálogo activo:
//   1. Es el seed exacto que carga la migración
//      002_auth_roles_countries_config.sql — mismos 6 países/tarifas, sin
//      pasos manuales extra al desplegar Fase 3.
//   2. Fallback defensivo: si useCountriesConfig() no puede leer la tabla
//      (RLS todavía no aplicado en un entorno viejo, red caída, tabla
//      vacía) useCampaignCalculator.js cae acá para no dejar la
//      Calculadora inutilizable — ver ese hook.
//
// `businessUnit`: es el valor exacto de la columna `business_unit` de
// `silver.sales` (base DWH, Metabase) contra el que Hermes filtra al
// calcular conversiones reales — en countries_config es la columna
// `metabase_code`. Mapeo dado por el usuario, no inferido: Colombia=CO,
// Argentina=AR, Chile=CL, Mexico=MX, Brasil NL=BR, Brasil LV=LV. Nota:
// `silver.sales` también tiene un business_unit "NL" además de "BR" — el
// usuario confirmó igual que "Brasil NL" debe mapear a "BR", no a "NL".
export const COUNTRIES = [
  { value: 'colombia', label: 'Colombia', costPerSms: 0.003, businessUnit: 'CO' },
  { value: 'chile', label: 'Chile', costPerSms: 0.025, businessUnit: 'CL' },
  { value: 'mexico', label: 'Mexico', costPerSms: 0.022, businessUnit: 'MX' },
  { value: 'argentina', label: 'Argentina', costPerSms: 0.057, businessUnit: 'AR' },
  { value: 'brasil-nl', label: 'Brasil NL', costPerSms: 0.016, businessUnit: 'BR' },
  { value: 'brasil-lv', label: 'Brasil LV', costPerSms: 0.016, businessUnit: 'LV' },
];

// Minerva — tarifas de SMS por país/segmento tarifario. Único lugar donde
// vive este catálogo (ver .claude/agents/minerva.md: "Minerva no conoce el
// esquema crudo... orquesta la jerarquía de datos"); Hefesto solo lo
// consume para pintar el <select> de país en CalculatorPage.
// Fuente: referencia visual del dropdown adjuntada por el usuario
// (pivote de Fase 1, sesión 2026-09-02).
//
// `businessUnit`: agregado en la sesión 2026-09-02 (ajuste de integración
// Metabase) por instrucción explícita del usuario — es el valor exacto de
// la columna `business_unit` de `silver.sales` (base DWH, Metabase) contra
// el que Hermes filtra al calcular conversiones reales. Mapeo dado por el
// usuario, no inferido: Colombia=CO, Argentina=AR, Chile=CL, Mexico=MX,
// Brasil NL=BR, Brasil LV=LV. Nota: `silver.sales` también tiene un
// business_unit "NL" además de "BR" — el usuario confirmó igual que
// "Brasil NL" debe mapear a "BR", no a "NL"; si en el futuro se detecta
// que el mapeo real es al revés, hay que corregir aquí (único lugar).
export const COUNTRIES = [
  { value: 'colombia', label: 'Colombia', costPerSms: 0.003, businessUnit: 'CO' },
  { value: 'chile', label: 'Chile', costPerSms: 0.025, businessUnit: 'CL' },
  { value: 'mexico', label: 'Mexico', costPerSms: 0.022, businessUnit: 'MX' },
  { value: 'argentina', label: 'Argentina', costPerSms: 0.057, businessUnit: 'AR' },
  { value: 'brasil-nl', label: 'Brasil NL', costPerSms: 0.016, businessUnit: 'BR' },
  { value: 'brasil-lv', label: 'Brasil LV', costPerSms: 0.016, businessUnit: 'LV' },
];

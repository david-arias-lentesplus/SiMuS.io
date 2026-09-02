// Minerva — tarifas de SMS por país/segmento tarifario. Único lugar donde
// vive este catálogo (ver .claude/agents/minerva.md: "Minerva no conoce el
// esquema crudo... orquesta la jerarquía de datos"); Hefesto solo lo
// consume para pintar el <select> de país en CalculatorPage.
// Fuente: referencia visual del dropdown adjuntada por el usuario
// (pivote de Fase 1, sesión 2026-09-02).
export const COUNTRIES = [
  { value: 'colombia', label: 'Colombia', costPerSms: 0.003 },
  { value: 'chile', label: 'Chile', costPerSms: 0.025 },
  { value: 'mexico', label: 'Mexico', costPerSms: 0.022 },
  { value: 'argentina', label: 'Argentina', costPerSms: 0.057 },
  { value: 'brasil-nl', label: 'Brasil NL', costPerSms: 0.016 },
  { value: 'brasil-lv', label: 'Brasil LV', costPerSms: 0.016 },
];

// Minerva — regla reactiva del pivote de Fase 1 (sesión 2026-09-02):
// "Tipo de evento" se auto-completa leyendo el nombre de campaña. Si el
// usuario cambia el <select> a mano, CalculatorPage deja de invocar esta
// función para ese formulario (ver useCampaignCalculator -> eventTypeTouched)
// — regla explícita del usuario, no se debe pisar una elección manual.
export const EVENT_TYPES = ['Comercial', 'Transaccional', 'Recordatorio', 'Retención', 'Bienvenida'];

const KEYWORD_MAP = [
  {
    type: 'Transaccional',
    keywords: ['confirmacion', 'pedido', 'orden', 'envio', 'entrega', 'factura', 'pago', 'recibo', 'compra'],
  },
  {
    type: 'Recordatorio',
    keywords: ['recordatorio', 'cita', 'turno', 'vence', 'vencimiento', 'agenda', 'reminder'],
  },
  {
    type: 'Retención',
    keywords: ['retencion', 'churn', 'reactivacion', 'volve', 'extranamos', 'winback', 'win-back'],
  },
  {
    type: 'Bienvenida',
    keywords: ['bienvenida', 'welcome', 'onboarding', 'registro', 'alta'],
  },
];

/**
 * Devuelve el primer tipo de evento cuyas palabras clave aparecen en el
 * nombre de campaña (comparación sin tildes/mayúsculas). Si ninguna
 * coincide, devuelve "Comercial" por defecto — regla explícita del
 * pivote de Fase 1.
 */
export function detectEventType(campaignName) {
  const normalized = normalize(campaignName);
  if (!normalized) return 'Comercial';
  for (const { type, keywords } of KEYWORD_MAP) {
    if (keywords.some((kw) => normalized.includes(kw))) return type;
  }
  return 'Comercial';
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita tildes para comparar
}

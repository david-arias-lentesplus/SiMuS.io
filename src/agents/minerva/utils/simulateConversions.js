// Minerva — simulación del cruce de conversiones (compras en los 7 días
// posteriores al envío). Desde la Fase 2 (sesión 2026-09-02) el tamaño de
// muestra ya es real (Hermes/HubSpot, ver fetchSegmentFromHubSpot.js);
// esto sigue simulado porque el cruce con compras depende de Metabase/
// Workingbits, que Iris todavía no integra (ver .claude/agents/iris.md,
// "Pendiente de definir"). Determinístico: el mismo segmento + el mismo
// sampleSize siempre devuelven el mismo resultado.
//
// TODO(Iris): reemplazar por el cruce real cuando exista la integración
// con Metabase/Workingbits — mismo shape de retorno (number).

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

// mulberry32: PRNG determinístico y liviano, sembrado con el hash del segmento.
function mulberry32(seed) {
  let t = seed;
  return function () {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const CONV_RATE_RANGES = {
  sms: [0.006, 0.03],
  control: [0.003, 0.014],
};

/**
 * @param {string} segmentName Nombre del segmento (mismo que se usó para buscar en HubSpot).
 * @param {'sms'|'control'} kind
 * @param {number} sampleSize Tamaño de muestra REAL devuelto por HubSpot.
 * @returns {number} conversiones simuladas
 */
export function simulateConversions(segmentName, kind, sampleSize) {
  const [min, max] = CONV_RATE_RANGES[kind] ?? CONV_RATE_RANGES.sms;
  const rand = mulberry32(hashString(`${kind}:conversions:${segmentName.trim().toLowerCase()}`));
  const convRate = min + rand() * (max - min);
  return Math.max(0, Math.round(sampleSize * convRate));
}

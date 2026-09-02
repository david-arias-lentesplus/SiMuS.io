// Minerva — motor de cálculo puro, equivalente a computeMetrics() del
// prototipo HTML original (calculadoraroisms010926.html). Sin efectos
// secundarios y sin acceso a Supabase/HubSpot/Workingbits: solo
// transforma los números que ya trae el formulario en el objeto `m`
// que consume src/agents/demeter/services/smsCampaignsService.js
// (toCampaignRow). Regla dura del pivote de Fase 1: esta función NUNCA
// guarda nada — el guardado en Supabase solo ocurre cuando el usuario
// aprueba explícitamente el reporte (ver useCampaignCalculator.approveAndSave).
export function computeMetrics(input) {
  const {
    name,
    countryName,
    smsCost,
    sendDate,
    smsMessage,
    eventType,
    smsN,
    smsC,
    smsS,
    ctrlN,
    ctrlC,
    ctrlS,
  } = input;

  const smsCR = smsN > 0 ? smsC / smsN : 0;
  const ctrlCR = ctrlN > 0 ? ctrlC / ctrlN : 0;
  const smsAOV = smsC > 0 ? smsS / smsC : 0;
  const ctrlAOV = ctrlC > 0 ? ctrlS / ctrlC : 0;
  const smsRPC = smsN > 0 ? smsS / smsN : 0;
  const ctrlRPC = ctrlN > 0 ? ctrlS / ctrlN : 0;

  // Conversiones del grupo control proyectadas al mismo tamaño de muestra
  // del grupo SMS, para comparar peras con peras en la tabla comparativa.
  const ctrlConvProjected = ctrlCR * smsN;

  const liftConv = ctrlConvProjected > 0 ? ((smsC - ctrlConvProjected) / ctrlConvProjected) * 100 : 0;
  const liftCR = ctrlCR > 0 ? ((smsCR - ctrlCR) / ctrlCR) * 100 : 0;
  const liftAOV = ctrlAOV > 0 ? ((smsAOV - ctrlAOV) / ctrlAOV) * 100 : 0;
  const liftRPC = ctrlRPC > 0 ? ((smsRPC - ctrlRPC) / ctrlRPC) * 100 : 0;

  const totalCost = smsN * smsCost;
  // Ventas orgánicas proyectadas: lo que el grupo SMS hubiera vendido si se
  // hubiera comportado como el grupo control (RPC control x N SMS) — esto
  // es lo que se descuenta para aislar el impacto real del canal.
  const organicSalesProjected = ctrlRPC * smsN;
  const netSmsSales = smsS - totalCost;
  const incrementalGain = smsS - organicSalesProjected;
  const numeratorROI = incrementalGain - totalCost;
  // roiReal se guarda como fracción (no %); HistoryPage.jsx y el reporte
  // multiplican por 100 al mostrarlo (ver sms_campaigns.roi_real en el SQL).
  const roiReal = totalCost > 0 ? numeratorROI / totalCost : 0;

  return {
    name,
    countryName,
    smsCost,
    sendDate,
    smsMessage,
    eventType,
    smsN,
    smsC,
    smsS,
    ctrlN,
    ctrlC,
    ctrlS,
    smsCR,
    ctrlCR,
    smsAOV,
    ctrlAOV,
    smsRPC,
    ctrlRPC,
    ctrlConvProjected,
    liftConv,
    liftCR,
    liftAOV,
    liftRPC,
    totalCost,
    organicSalesProjected,
    netSmsSales,
    incrementalGain,
    numeratorROI,
    roiReal,
  };
}

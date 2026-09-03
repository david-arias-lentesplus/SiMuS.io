-- Deméter — Fase 2.3 ("REFINAMIENTO FASE 2.3 — OPTIMIZACIÓN DE QUERYS Y
-- AUTOMATIZACIÓN DE CSV").
-- Migración: 005_processed_campaigns_communication_start_date
--
-- Éter ahora extrae también la columna `Communication Start Date` del CSV
-- de Workingbits (ver parseWorkingbitsCsv.js) — un campo DISTINTO de
-- `send_date` (`Send At`, que puede variar fila a fila dentro de la misma
-- campaña si el envío se hizo en tandas). `Communication Start Date` es
-- la fecha real de inicio de la comunicación, y desde esta sesión es la
-- que la Calculadora usa para autocompletar (y bloquear) "Fecha de
-- envío" — ver useCampaignCalculator.js.
--
-- Se guarda como texto, igual que `send_date` (mismo motivo: Workingbits
-- no garantiza un formato de fecha único; el parseo a 'YYYY-MM-DD' lo
-- hace parseCsvDate.js en el cliente, no la base de datos).

alter table public.sms_processed_campaigns
  add column if not exists communication_start_date text;

comment on column public.sms_processed_campaigns.communication_start_date is
  'Primer valor de "Communication Start Date" del CSV de Workingbits para esta campaña (Fase 2.3). Distinto de send_date ("Send At"): es el que la Calculadora usa para autocompletar y bloquear "Fecha de envío". Puede ser NULL para campañas cargadas antes de esta migración — en ese caso la Calculadora cae a send_date (ver useCampaignCalculator.js).';

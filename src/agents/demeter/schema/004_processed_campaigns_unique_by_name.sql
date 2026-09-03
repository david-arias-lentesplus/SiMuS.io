-- Deméter — corrección de Fase 2.2 ("CORRECCIÓN FASE 2.2 — RESTAURACIÓN
-- DE HUBSPOT Y MANEJO DE DUPLICADOS").
-- Migración: 004_processed_campaigns_unique_by_name
--
-- La migración 003 declaró el unique constraint de
-- `sms_processed_campaigns` como (campaign_name, country_value). El
-- usuario corrigió esa regla de negocio: el identificador único de una
-- campaña procesada debe ser SOLO `campaign_name` (`Communication Name`
-- del CSV de Workingbits) — así, volver a subir un CSV para la misma
-- campaña (incluso si por error se elige un país distinto) sobreescribe
-- la fila existente en vez de crear un duplicado.
--
-- Riesgo aceptado explícitamente por esta regla (documentado en ADR
-- 0009): si dos países distintos llegaran a compartir el mismo
-- `Communication Name` en Workingbits, la segunda carga sobreescribiría
-- a la primera. El usuario definió el identificador único así a
-- propósito; no se agrega ninguna validación adicional que lo contradiga.

alter table public.sms_processed_campaigns
  drop constraint if exists sms_processed_campaigns_unique_name_country;

alter table public.sms_processed_campaigns
  add constraint sms_processed_campaigns_unique_name unique (campaign_name);

comment on constraint sms_processed_campaigns_unique_name on public.sms_processed_campaigns is
  'Identificador único de negocio = Communication Name del CSV de Workingbits (Fase 2.2). Reemplaza el constraint compuesto (campaign_name, country_value) de la migración 003.';

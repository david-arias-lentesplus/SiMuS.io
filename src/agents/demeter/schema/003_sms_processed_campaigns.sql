-- Deméter — Fase 2.1 (pivote: descarte de la API de Workingbits, carga de
-- CSV exportado manualmente por el usuario).
-- Migración: 003_sms_processed_campaigns
--
-- Fuente de verdad de las campañas que Éter agrupó desde el CSV de
-- Workingbits (una fila = una campaña ya agrupada, no una fila cruda del
-- CSV). Esta tabla alimenta el <select> de "Nombre de la campaña" de la
-- Calculadora (ver src/agents/minerva/hooks/useCampaignCalculator.js) —
-- es DISTINTA de `sms_campaigns` (que guarda el REPORTE ya calculado y
-- aprobado). `sms_processed_campaigns` es un paso intermedio: datos
-- extraídos del CSV, todavía no calculados ni aprobados.

create extension if not exists "pgcrypto";

create table if not exists public.sms_processed_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id) on delete set null,

  campaign_name       text not null,
  country_value       text not null,       -- 'value' de countries_config/countries.js (ej. 'colombia')
  send_date           text,                 -- 'Send At' crudo del CSV (primer valor del grupo); se
                                             -- guarda como texto porque Workingbits no garantiza un
                                             -- formato de fecha único — la Calculadora lo interpreta
                                             -- al autocompletar el <input type="date">.
  message             text,                 -- primer 'Text' del grupo
  muestra_entregados  integer not null default 0 check (muestra_entregados >= 0),
  telefonos_validos   jsonb not null default '[]'::jsonb, -- array de teléfonos limpios (sin indicativo)
  total_rows          integer not null default 0 check (total_rows >= 0), -- filas totales del CSV para esta campaña (auditoría)

  constraint sms_processed_campaigns_unique_name_country unique (campaign_name, country_value)
);

comment on table public.sms_processed_campaigns is
  'Campañas agrupadas desde el CSV de Workingbits por Éter (Fase 2.1). Alimenta el <select> de la Calculadora; NO es el reporte final calculado (eso vive en sms_campaigns). Escritura/lectura exclusiva vía src/agents/demeter/services/processedCampaignsService.js.';

create index if not exists idx_sms_processed_campaigns_created_at on public.sms_processed_campaigns (created_at desc);
create index if not exists idx_sms_processed_campaigns_country     on public.sms_processed_campaigns (country_value);

-- RLS: mismo criterio que sms_campaigns (migración 002) — la Calculadora
-- y /upload son ambas rutas admin-only (ver AppRoutes.jsx), así que solo
-- admin necesita tocar esta tabla. Viewer no tiene ruta que la use hoy;
-- se deja sin policy de select para viewer a propósito (si en el futuro
-- una vista de solo lectura para viewer la necesita, agregar una policy
-- de select "to authenticated using (true)" como en sms_campaigns).
alter table public.sms_processed_campaigns enable row level security;

create policy "sms_processed_campaigns_all_admin_only"
  on public.sms_processed_campaigns for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- ADVERTENCIA (mismo patrón que 002_auth_roles_countries_config.sql):
-- esta tabla depende de public.is_admin(), definida en esa migración.
-- Aplicar 002 antes que esta.
-- ============================================================

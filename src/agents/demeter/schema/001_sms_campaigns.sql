-- Deméter — esquema inicial de persistencia (Supabase/Postgres)
-- Migración: 001_sms_campaigns
-- Fecha: 2026-09-01
--
-- Origen: extraído del payload de la calculadora ROI de SMS adjunta por el
-- usuario (calculadoraroisms010926.html, funciones computeMetrics() y
-- calculate()). Esta tabla es la fuente de verdad permanente que reemplaza
-- la ventana de 90 días de retención de Workingbits (ver ADR 0002).
--
-- Nota Deméter: esta es la Fase 1 (una fila = una campaña ya calculada,
-- cargada manualmente o vía integración futura con Iris/Workingbits).
-- Cuando Iris defina el mecanismo de extracción de eventos crudos de
-- Workingbits, esos eventos deberán vivir en tablas propias
-- (sms_messages, sms_delivery_events) que se agreguen hacia esta tabla o
-- la reemplacen; queda registrado en "Pendiente de definir" del README de
-- este agente.

create extension if not exists "pgcrypto";

create table if not exists public.sms_campaigns (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  -- Identificación de campaña
  campaign_name     text not null,
  country           text not null,           -- nombre de país/segmento tarifario (ej. 'Colombia', 'Brasil NL')
  sms_cost_unit     numeric(10,4) not null,   -- costo por SMS en la moneda/tarifa del país
  send_date         date,                     -- fecha de envío de la campaña (opcional)
  sms_message       text,                     -- copy del mensaje enviado (opcional)
  event_type        text default 'Comercial', -- ej. Comercial, Transaccional, Retención

  -- Grupo SMS (tratamiento)
  sms_sample        integer not null check (sms_sample >= 0),
  sms_conv          integer not null check (sms_conv >= 0),
  sms_sales         numeric(14,2) not null default 0,

  -- Grupo control
  ctrl_sample       integer not null check (ctrl_sample >= 0),
  ctrl_conv         integer not null check (ctrl_conv >= 0),
  ctrl_sales        numeric(14,2) not null default 0,

  -- Métricas derivadas (calculadas en el cliente por computeMetrics();
  -- se persisten ya calculadas para no recalcular sobre datos históricos
  -- si cambia la fórmula en el futuro — ver nota de Apolo en README)
  sms_cr            numeric(8,6),   -- sms_conv / sms_sample
  ctrl_cr           numeric(8,6),   -- ctrl_conv / ctrl_sample
  sms_aov           numeric(14,2),  -- sms_sales / sms_conv
  ctrl_aov          numeric(14,2),  -- ctrl_sales / ctrl_conv
  sms_rpc           numeric(14,4),  -- sms_sales / sms_sample
  ctrl_rpc          numeric(14,4),  -- ctrl_sales / ctrl_sample
  lift_conv         numeric(10,4),  -- lift % de conversiones vs. control proyectado
  lift_cr           numeric(10,4),  -- lift % de tasa de conversión vs. control

  total_sms_cost    numeric(14,2) not null default 0,  -- sms_sample * sms_cost_unit
  roi_real          numeric(10,6) not null default 0    -- (ventas incrementales - costo) / costo

);

comment on table public.sms_campaigns is
  'Fuente de verdad permanente de campañas de SMS y su ROI. Reemplaza la retención de 90 días de Workingbits (ADR 0002). Escritura/lectura exclusiva vía src/agents/demeter/services/smsCampaignsService.js.';

create index if not exists idx_sms_campaigns_created_at on public.sms_campaigns (created_at desc);
create index if not exists idx_sms_campaigns_country     on public.sms_campaigns (country);
create index if not exists idx_sms_campaigns_send_date   on public.sms_campaigns (send_date);

-- ============================================================
-- ADVERTENCIA (Deméter, 2026-09-01, verificado contra el proyecto real):
-- La tabla `sms_campaigns` YA EXISTE en el proyecto Supabase del usuario
-- (qzothtkbqnorwmhgxktw) con 17 campañas históricas reales (jun-2026) y
-- se confirmó que la anon key puede leerla hoy SIN estar autenticada
-- (no hay login/rol "authenticated" implementado todavía — Eleuthia no
-- ha construido auth). Eso significa que, o RLS está deshabilitado en la
-- tabla real, o ya existe una policy que permite al rol "anon".
--
-- NO EJECUTAR el bloque "alter table ... enable row level security" ni
-- las policies de abajo contra ese proyecto tal cual están escritas: al
-- restringir a rol "authenticated" sin que exista un flujo de login real,
-- el front-end (que siempre pega con la anon key) se quedaría sin poder
-- leer ni escribir campañas, rompiendo el Dashboard/Histórico en
-- producción. Este bloque queda como especificación de la política
-- DESEADA a futuro, a aplicar coordinado con Eleuthia cuando exista auth.
-- ============================================================

-- Row Level Security — placeholder explícito.
-- Deméter deja RLS habilitado desde el día 1 (regla de arquitectura:
-- "RLS debe estar configurado y documentado para cada tabla sensible").
-- La política real depende de la matriz de roles que Eleuthia aún no ha
-- definido (ver .claude/agents/eleuthia.md → Pendiente de definir).
-- Hasta que exista esa matriz, se deja acceso solo a rol autenticado como
-- placeholder explícito — NO usar en producción sin revisión de Eleuthia.
alter table public.sms_campaigns enable row level security;

create policy "sms_campaigns_select_authenticated"
  on public.sms_campaigns for select
  to authenticated
  using (true);

create policy "sms_campaigns_insert_authenticated"
  on public.sms_campaigns for insert
  to authenticated
  with check (true);

-- TODO(Eleuthia + Deméter): reemplazar las policies anteriores por reglas
-- basadas en rol/equipo una vez exista la matriz de permisos, y decidir si
-- delete/update deben restringirse a rol admin (el HTML de referencia
-- permite borrar filas individuales y "borrar todo" sin restricción de rol,
-- lo cual no debe pasar tal cual a producción).

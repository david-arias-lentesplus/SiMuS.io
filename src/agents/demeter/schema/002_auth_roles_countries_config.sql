-- Deméter — Fase 3 (2026-09-02, "AUTENTICACIÓN, CONFIGURACIÓN Y UI POLISH")
-- Migración: 002_auth_roles_countries_config
--
-- Activa Eleuthia (auth/roles) y agrega el catálogo editable de países
-- que reemplaza el arreglo estático COUNTRIES de
-- src/agents/minerva/constants/countries.js. Ver ADR 0007 para el diseño
-- completo (modelo de roles, por qué security definer en is_admin(), y
-- el orden de despliegue obligatorio).
--
-- ============================================================
-- ADVERTENCIA — ORDEN DE DESPLIEGUE OBLIGATORIO (leer antes de ejecutar):
-- Este archivo, a diferencia de 001_sms_campaigns.sql, SÍ activa RLS real
-- sobre `sms_campaigns` (reemplaza las policies "_authenticated" abiertas
-- por policies con chequeo de rol) y dos tablas nuevas. Una vez aplicado:
--   1. El frontend DEBE tener ya desplegado el flujo de login (esta misma
--      sesión, Fase 3) — sin sesión autenticada, la anon key deja de
--      poder leer/escribir absolutamente nada en estas tablas.
--   2. Debes promover a mano al primer usuario admin ANTES de que nadie
--      pueda usar /settings/users para invitar al resto (nadie puede ser
--      admin todavía). Después de que ese primer usuario se registre
--      (Supabase Dashboard -> Authentication -> Add user, o que tú mismo
--      inicies sesión una vez con Supabase Auth), corre a mano:
--        update public.profiles set role = 'admin' where email = 'tu-correo@dominio.com';
--   3. Recomendado: aplicar esta migración y desplegar el frontend en la
--      MISMA ventana de mantenimiento — entre el paso 1 y el paso 2 la
--      Calculadora/Histórico dejan de responder para cualquiera sin
--      sesión (comportamiento esperado y deseado, pero avisa al equipo).
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Perfiles de usuario interno (rol) — Eleuthia
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  full_name     text,
  role          text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil + rol del equipo interno que usa SiMuS.io (admin | viewer). Una fila por usuario de auth.users, creada automáticamente por el trigger on_auth_user_created. Fase 3, ADR 0007.';

-- Trigger: cualquier alta nueva en auth.users (signup normal o invitación
-- vía auth.admin.inviteUserByEmail desde api/admin/invite-user.js) crea
-- automáticamente su fila en profiles con role='viewer' por defecto.
-- api/admin/invite-user.js ajusta el rol elegido inmediatamente después
-- si el admin invitó como 'admin'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper de rol, reutilizado por las policies de esta tabla y de
-- countries_config/sms_campaigns más abajo. security definer + search_path
-- fijo: necesita leer profiles sin quedar bloqueada por la propia RLS de
-- profiles (que restringe select a "yo mismo o un admin" — chequear si
-- alguien es admin necesita leer la fila de OTRO usuario, la propia).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

create policy "profiles_select_self_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_admin_only"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles_delete_admin_only"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- No hay policy de insert para el cliente a propósito: la única vía de
-- alta es el trigger on_auth_user_created (security definer, bypassa
-- RLS). Ni el admin ni nadie más debe poder insertar filas de profiles
-- "sueltas" sin un usuario real de auth.users detrás.

-- ------------------------------------------------------------
-- 2. Catálogo editable de países/tarifas — Deméter
-- ------------------------------------------------------------
create table if not exists public.countries_config (
  id             uuid primary key default gen_random_uuid(),
  country_name   text not null,
  sms_price      numeric(10, 4) not null check (sms_price >= 0),
  currency       text not null default 'USD',
  metabase_code  text not null,          -- business_unit en silver.sales (Metabase) — ver metabaseService.js
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.countries_config is
  'Catálogo editable de países/tarifas de SMS, gestionado desde /settings/countries (solo admin). Reemplaza el arreglo estático COUNTRIES de src/agents/minerva/constants/countries.js (Fase 3, ADR 0007). metabase_code debe coincidir exactamente con un valor real de silver.sales.business_unit.';

create unique index if not exists idx_countries_config_metabase_code on public.countries_config (metabase_code);

alter table public.countries_config enable row level security;

create policy "countries_config_select_authenticated"
  on public.countries_config for select
  to authenticated
  using (true); -- admin y viewer pueden leer el catálogo (lo necesita la Calculadora)

create policy "countries_config_write_admin_only"
  on public.countries_config for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Seed: mismos 6 países/tarifas que hoy viven hardcodeados en
-- src/agents/minerva/constants/countries.js, para que la migración deje
-- la Calculadora funcionando igual que antes sin pasos manuales extra.
insert into public.countries_config (country_name, sms_price, currency, metabase_code)
values
  ('Colombia', 0.003, 'USD', 'CO'),
  ('Chile', 0.025, 'USD', 'CL'),
  ('Mexico', 0.022, 'USD', 'MX'),
  ('Argentina', 0.057, 'USD', 'AR'),
  ('Brasil NL', 0.016, 'USD', 'BR'),
  ('Brasil LV', 0.016, 'USD', 'LV')
on conflict (metabase_code) do nothing;

-- ------------------------------------------------------------
-- 3. sms_campaigns: activar RLS real por rol (reemplaza el placeholder
--    de 001_sms_campaigns.sql, que dejaba select/insert abiertos a
--    cualquier usuario autenticado sin distinguir rol porque todavía no
--    existía Eleuthia).
-- ------------------------------------------------------------
drop policy if exists "sms_campaigns_select_authenticated" on public.sms_campaigns;
drop policy if exists "sms_campaigns_insert_authenticated" on public.sms_campaigns;

create policy "sms_campaigns_select_authenticated"
  on public.sms_campaigns for select
  to authenticated
  using (true); -- admin y viewer pueden ver Dashboard/Histórico

create policy "sms_campaigns_insert_admin_only"
  on public.sms_campaigns for insert
  to authenticated
  with check (public.is_admin()); -- viewer no puede calcular/guardar campañas nuevas

create policy "sms_campaigns_update_admin_only"
  on public.sms_campaigns for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "sms_campaigns_delete_admin_only"
  on public.sms_campaigns for delete
  to authenticated
  using (public.is_admin()); -- viewer no puede eliminar histórico (fila individual ni "eliminar todo")

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = pg_catalog.timezone('utc', pg_catalog.now());
  return new;
end;
$$;

create table if not exists public.condominiums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  contact_phone text,
  tower_count integer,
  floors_per_tower integer,
  units_per_floor integer,
  tower_naming text,
  tower_prefix text,
  floor_start integer,
  unit_pattern text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  label text not null,
  block text,
  floor text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (condominium_id, label)
);

create table if not exists public.residents (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.operator_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text not null unique,
  is_active boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.operator_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.operator_users(id) on delete cascade,
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  role text not null default 'operator' check (role in ('admin', 'operator')),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id)
);

alter table public.operator_users
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists onboarding_completed boolean not null default false;

alter table public.operator_users
  drop column if exists password_hash,
  drop column if exists password_set_at;

alter table public.condominiums
  add column if not exists tower_count integer,
  add column if not exists floors_per_tower integer,
  add column if not exists units_per_floor integer,
  add column if not exists tower_naming text,
  add column if not exists tower_prefix text,
  add column if not exists floor_start integer,
  add column if not exists unit_pattern text;

drop table if exists public.operator_sessions cascade;
drop table if exists public.operator_password_setup_tokens cascade;

create unique index if not exists operator_users_auth_user_id_idx
  on public.operator_users (auth_user_id)
  where auth_user_id is not null;

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid references public.condominiums(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  resident_id uuid references public.residents(id) on delete set null,
  resident_name text not null,
  resident_phone text,
  apartment text not null,
  carrier text,
  description text,
  package_photo_url text,
  source text not null default 'manual',
  status text not null default 'pending',
  internal_notes text,
  received_at timestamptz not null default timezone('utc', now()),
  notified_at timestamptz,
  picked_up_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.delivery_status_history (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  from_status text,
  to_status text not null,
  change_reason text,
  actor_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.delivery_pickup_tokens (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  token_value text not null unique,
  status text not null default 'active' check (status in ('active', 'used', 'cancelled', 'expired')),
  expires_at timestamptz not null,
  created_by uuid references public.operator_users(id) on delete set null,
  used_by uuid references public.operator_users(id) on delete set null,
  used_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  channel text not null default 'whatsapp',
  target text,
  provider text not null default 'evolution',
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'read', 'failed')),
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  attempted_at timestamptz not null default timezone('utc', now())
);

alter table public.notification_attempts
  drop constraint if exists notification_attempts_status_check;

alter table public.notification_attempts
  add constraint notification_attempts_status_check
  check (status in ('pending', 'sent', 'delivered', 'read', 'failed'));

alter table public.deliveries
  add column if not exists condominium_id uuid references public.condominiums(id) on delete set null,
  add column if not exists unit_id uuid references public.units(id) on delete set null,
  add column if not exists resident_id uuid references public.residents(id) on delete set null,
  add column if not exists resident_phone text,
  add column if not exists package_photo_url text,
  add column if not exists source text not null default 'manual',
  add column if not exists internal_notes text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.deliveries
  drop constraint if exists deliveries_status_check;

alter table public.deliveries
  add constraint deliveries_status_check
  check (status in ('pending', 'notified', 'picked_up', 'cancelled'));

create index if not exists units_condominium_id_idx
  on public.units (condominium_id);

create index if not exists residents_condominium_id_idx
  on public.residents (condominium_id);

create index if not exists residents_unit_id_idx
  on public.residents (unit_id);

create index if not exists operator_memberships_user_id_idx
  on public.operator_memberships (user_id);

create index if not exists operator_memberships_condominium_id_idx
  on public.operator_memberships (condominium_id);

create index if not exists deliveries_received_at_idx
  on public.deliveries (received_at desc);

create index if not exists deliveries_status_idx
  on public.deliveries (status);

create index if not exists deliveries_condominium_id_idx
  on public.deliveries (condominium_id);

create index if not exists deliveries_unit_id_idx
  on public.deliveries (unit_id);

create index if not exists deliveries_resident_id_idx
  on public.deliveries (resident_id);

create index if not exists deliveries_resident_phone_idx
  on public.deliveries (resident_phone);

create index if not exists delivery_status_history_delivery_id_idx
  on public.delivery_status_history (delivery_id, created_at desc);

create index if not exists notification_attempts_delivery_id_idx
  on public.notification_attempts (delivery_id, attempted_at desc);

create index if not exists delivery_pickup_tokens_delivery_id_idx
  on public.delivery_pickup_tokens (delivery_id, created_at desc);

create index if not exists delivery_pickup_tokens_condominium_id_idx
  on public.delivery_pickup_tokens (condominium_id, status);

drop trigger if exists condominiums_set_updated_at on public.condominiums;
create trigger condominiums_set_updated_at
before update on public.condominiums
for each row execute function public.set_updated_at();

drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

drop trigger if exists residents_set_updated_at on public.residents;
create trigger residents_set_updated_at
before update on public.residents
for each row execute function public.set_updated_at();

drop trigger if exists operator_users_set_updated_at on public.operator_users;
create trigger operator_users_set_updated_at
before update on public.operator_users
for each row execute function public.set_updated_at();

drop trigger if exists operator_memberships_set_updated_at on public.operator_memberships;
create trigger operator_memberships_set_updated_at
before update on public.operator_memberships
for each row execute function public.set_updated_at();

drop trigger if exists deliveries_set_updated_at on public.deliveries;
create trigger deliveries_set_updated_at
before update on public.deliveries
for each row execute function public.set_updated_at();

alter table public.condominiums enable row level security;
alter table public.units enable row level security;
alter table public.residents enable row level security;
alter table public.operator_users enable row level security;
alter table public.operator_memberships enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_status_history enable row level security;
alter table public.notification_attempts enable row level security;
alter table public.delivery_pickup_tokens enable row level security;

drop policy if exists condominiums_no_direct_access on public.condominiums;
create policy condominiums_no_direct_access
on public.condominiums
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists units_no_direct_access on public.units;
create policy units_no_direct_access
on public.units
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists residents_no_direct_access on public.residents;
create policy residents_no_direct_access
on public.residents
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists operator_users_no_direct_access on public.operator_users;
create policy operator_users_no_direct_access
on public.operator_users
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists operator_memberships_no_direct_access on public.operator_memberships;
create policy operator_memberships_no_direct_access
on public.operator_memberships
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists deliveries_no_direct_access on public.deliveries;
create policy deliveries_no_direct_access
on public.deliveries
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists delivery_status_history_no_direct_access on public.delivery_status_history;
create policy delivery_status_history_no_direct_access
on public.delivery_status_history
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists notification_attempts_no_direct_access on public.notification_attempts;
create policy notification_attempts_no_direct_access
on public.notification_attempts
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists delivery_pickup_tokens_no_direct_access on public.delivery_pickup_tokens;
create policy delivery_pickup_tokens_no_direct_access
on public.delivery_pickup_tokens
for all
to anon, authenticated
using (false)
with check (false);

insert into public.condominiums (name, slug)
select 'Condominio Padrao', 'condominio-padrao'
where not exists (
  select 1 from public.condominiums where slug = 'condominio-padrao'
);

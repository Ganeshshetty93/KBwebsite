create extension if not exists "pgcrypto";

create table if not exists public.kb_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  phone text,
  role text not null default 'member',
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null default 'Admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_registrations (
  id uuid primary key default gen_random_uuid(),
  parent_name text,
  student_name text,
  email text not null,
  phone text,
  program text,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_logins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_donations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  amount numeric not null default 0,
  cause_id uuid,
  cause_title text,
  payment_status text not null default 'Pending',
  created_at timestamptz not null default now()
);

alter table public.kb_donations
add column if not exists cause_id uuid,
add column if not exists cause_title text,
add column if not exists payment_status text not null default 'Pending';

create table if not exists public.kb_volunteers (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  interest text,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  topic text,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_classes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  status text,
  date text,
  time text,
  age text,
  fee text,
  location text,
  focus text,
  photo text,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_events (
  id uuid primary key default gen_random_uuid(),
  event_id text,
  url_key text,
  event_type text,
  month text not null,
  title text not null,
  body text,
  location text,
  start_on timestamptz,
  end_on timestamptz,
  recurrence text,
  capacity integer not null default 0,
  is_all_day boolean not null default false,
  is_age_restricted boolean not null default false,
  is_payment_required boolean not null default false,
  enable_defaulter_fine boolean not null default false,
  is_open_for_registration boolean not null default false,
  is_auto_approved boolean not null default false,
  enabled boolean not null default true,
  display_seat_numbers boolean not null default false,
  free_for_volunteers boolean not null default false,
  enable_check_in boolean not null default false,
  enable_volunteer_discount boolean not null default false,
  photo text,
  created_at timestamptz not null default now()
);

alter table public.kb_events add column if not exists event_id text;
alter table public.kb_events add column if not exists url_key text;
alter table public.kb_events add column if not exists event_type text;
alter table public.kb_events add column if not exists start_on timestamptz;
alter table public.kb_events add column if not exists end_on timestamptz;
alter table public.kb_events add column if not exists recurrence text;
alter table public.kb_events add column if not exists capacity integer not null default 0;
alter table public.kb_events add column if not exists is_all_day boolean not null default false;
alter table public.kb_events add column if not exists is_age_restricted boolean not null default false;
alter table public.kb_events add column if not exists is_payment_required boolean not null default false;
alter table public.kb_events add column if not exists enable_defaulter_fine boolean not null default false;
alter table public.kb_events add column if not exists is_open_for_registration boolean not null default false;
alter table public.kb_events add column if not exists is_auto_approved boolean not null default false;
alter table public.kb_events add column if not exists enabled boolean not null default true;
alter table public.kb_events add column if not exists display_seat_numbers boolean not null default false;
alter table public.kb_events add column if not exists free_for_volunteers boolean not null default false;
alter table public.kb_events add column if not exists enable_check_in boolean not null default false;
alter table public.kb_events add column if not exists enable_volunteer_discount boolean not null default false;

create table if not exists public.kb_fundraisers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  beneficiary text,
  purpose text,
  goal numeric not null default 0,
  raised numeric not null default 0,
  deadline date,
  status text not null default 'Active',
  photo text,
  created_at timestamptz not null default now()
);

alter table public.kb_users enable row level security;
alter table public.kb_admins enable row level security;
alter table public.kb_registrations enable row level security;
alter table public.kb_logins enable row level security;
alter table public.kb_donations enable row level security;
alter table public.kb_volunteers enable row level security;
alter table public.kb_contacts enable row level security;
alter table public.kb_classes enable row level security;
alter table public.kb_events enable row level security;
alter table public.kb_fundraisers enable row level security;

drop policy if exists "Public can read classes" on public.kb_classes;
create policy "Public can read classes"
on public.kb_classes
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read events" on public.kb_events;
create policy "Public can read events"
on public.kb_events
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read fundraisers" on public.kb_fundraisers;
create policy "Public can read fundraisers"
on public.kb_fundraisers
for select
to anon, authenticated
using (true);

insert into public.kb_admins (email, name, active)
values ('test@gmail.com', 'Kannada Bharati Admin', true)
on conflict (email) do update set active = excluded.active, name = excluded.name;

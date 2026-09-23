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
  created_at timestamptz not null default now()
);

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
  month text not null,
  title text not null,
  body text,
  location text,
  photo text,
  created_at timestamptz not null default now()
);

alter table public.kb_users enable row level security;
alter table public.kb_registrations enable row level security;
alter table public.kb_logins enable row level security;
alter table public.kb_donations enable row level security;
alter table public.kb_volunteers enable row level security;
alter table public.kb_contacts enable row level security;
alter table public.kb_classes enable row level security;
alter table public.kb_events enable row level security;

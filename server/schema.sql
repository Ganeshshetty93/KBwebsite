create extension if not exists "pgcrypto";

create table if not exists public.kb_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  phone text,
  role text not null default 'member',
  roles text[] not null default array['member'],
  password_hash text,
  enabled boolean not null default true,
  email_confirmed boolean not null default false,
  email_confirmation_token text,
  password_reset_token text,
  password_reset_expires_at timestamptz,
  two_factor_enabled boolean not null default false,
  is_volunteering_defaulter boolean not null default false,
  defaulter_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kb_users add column if not exists roles text[] not null default array['member'];
alter table public.kb_users add column if not exists enabled boolean not null default true;
alter table public.kb_users add column if not exists email_confirmed boolean not null default false;
alter table public.kb_users add column if not exists email_confirmation_token text;
alter table public.kb_users add column if not exists password_reset_token text;
alter table public.kb_users add column if not exists password_reset_expires_at timestamptz;
alter table public.kb_users add column if not exists two_factor_enabled boolean not null default false;
alter table public.kb_users add column if not exists is_volunteering_defaulter boolean not null default false;
alter table public.kb_users add column if not exists defaulter_notes text;
alter table public.kb_users add column if not exists updated_at timestamptz not null default now();

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
  family_member text,
  paid boolean not null default false,
  email_status text,
  birth_year text,
  status text not null default 'Submitted',
  event_id text,
  fee text,
  amount numeric not null default 0,
  seats integer not null default 1,
  adults integer not null default 1,
  kids integer not null default 0,
  young_kids integer not null default 0,
  total_members integer not null default 1,
  registration_type text not null default 'member',
  rsvp jsonb,
  price_menu jsonb,
  payment_received boolean not null default false,
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.kb_registrations add column if not exists family_member text;
alter table public.kb_registrations add column if not exists paid boolean not null default false;
alter table public.kb_registrations add column if not exists email_status text;
alter table public.kb_registrations add column if not exists birth_year text;
alter table public.kb_registrations add column if not exists status text not null default 'Submitted';
alter table public.kb_registrations add column if not exists event_id text;
alter table public.kb_registrations add column if not exists fee text;
alter table public.kb_registrations add column if not exists amount numeric not null default 0;
alter table public.kb_registrations add column if not exists seats integer not null default 1;
alter table public.kb_registrations add column if not exists adults integer not null default 1;
alter table public.kb_registrations add column if not exists kids integer not null default 0;
alter table public.kb_registrations add column if not exists young_kids integer not null default 0;
alter table public.kb_registrations add column if not exists total_members integer not null default 1;
alter table public.kb_registrations add column if not exists registration_type text not null default 'member';
alter table public.kb_registrations add column if not exists rsvp jsonb;
alter table public.kb_registrations add column if not exists price_menu jsonb;
alter table public.kb_registrations add column if not exists payment_received boolean not null default false;
alter table public.kb_registrations add column if not exists checked_in boolean not null default false;
alter table public.kb_registrations add column if not exists checked_in_at timestamptz;
alter table public.kb_registrations add column if not exists enabled boolean not null default true;

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
  paypal_order_id text,
  paypal_capture_id text,
  payment_payload jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.kb_donations
add column if not exists cause_id uuid,
add column if not exists cause_title text,
add column if not exists payment_status text not null default 'Pending',
add column if not exists paypal_order_id text,
add column if not exists paypal_capture_id text,
add column if not exists payment_payload jsonb,
add column if not exists updated_at timestamptz not null default now();

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
  price numeric not null default 0,
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
  volunteer_discount_percentage numeric not null default 0,
  defaulter_fine_amount numeric not null default 0,
  rsvp jsonb,
  price_menu jsonb,
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
alter table public.kb_events add column if not exists price numeric not null default 0;
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
alter table public.kb_events add column if not exists volunteer_discount_percentage numeric not null default 0;
alter table public.kb_events add column if not exists defaulter_fine_amount numeric not null default 0;
alter table public.kb_events add column if not exists rsvp jsonb;
alter table public.kb_events add column if not exists price_menu jsonb;

create table if not exists public.kb_fundraisers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  beneficiary text,
  purpose text,
  details text,
  goal numeric not null default 0,
  goal_amount numeric not null default 0,
  raised numeric not null default 0,
  raised_amount numeric not null default 0,
  deadline date,
  needed_by date,
  status text not null default 'Active',
  enabled boolean not null default true,
  photo text,
  created_at timestamptz not null default now()
);

alter table public.kb_fundraisers add column if not exists details text;
alter table public.kb_fundraisers add column if not exists goal_amount numeric not null default 0;
alter table public.kb_fundraisers add column if not exists raised_amount numeric not null default 0;
alter table public.kb_fundraisers add column if not exists needed_by date;
alter table public.kb_fundraisers add column if not exists enabled boolean not null default true;

create table if not exists public.kb_announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  cta_text text,
  cta_url text,
  start_on timestamptz,
  end_on timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  amount numeric not null default 0,
  expense_date date,
  description text,
  vendor text,
  payment_method text,
  reimbursement_to text,
  receipt_url text,
  receipt_name text,
  receipt_type text,
  receipt_size numeric not null default 0,
  status text not null default 'Submitted',
  submitted_by text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.kb_expenses add column if not exists approved_by text;
alter table public.kb_expenses add column if not exists approved_at timestamptz;
alter table public.kb_expenses add column if not exists vendor text;
alter table public.kb_expenses add column if not exists payment_method text;
alter table public.kb_expenses add column if not exists reimbursement_to text;
alter table public.kb_expenses add column if not exists receipt_url text;
alter table public.kb_expenses add column if not exists receipt_name text;
alter table public.kb_expenses add column if not exists receipt_type text;
alter table public.kb_expenses add column if not exists receipt_size numeric not null default 0;

create table if not exists public.kb_event_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_recurrence_options (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.kb_site_settings (key, value)
values (
  'volunteer-google-form',
  '{"enabled": false, "url": "https://docs.google.com/forms/d/e/1FAIpQLSc1etxiGQgKR7XKhpSBd5UuLR-9-_0KDmxg7Zxd98RXK1w2Kg/viewform?embedded=true"}'::jsonb
)
on conflict (key) do update
set value = jsonb_set(
  public.kb_site_settings.value,
  '{url}',
  '"https://docs.google.com/forms/d/e/1FAIpQLSc1etxiGQgKR7XKhpSBd5UuLR-9-_0KDmxg7Zxd98RXK1w2Kg/viewform?embedded=true"'::jsonb
)
where coalesce(public.kb_site_settings.value->>'url', '') = '';

create table if not exists public.kb_member_profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  first_name text,
  last_name text,
  birth_date date,
  phone text,
  gender text,
  company text,
  description text,
  address1 text,
  address2 text,
  city text,
  state text,
  zip_code text,
  spouse_first_name text,
  spouse_last_name text,
  spouse_birth_date date,
  photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_member_children (
  id uuid primary key default gen_random_uuid(),
  profile_email text not null,
  first_name text not null,
  last_name text,
  gender text,
  birth_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_checkins (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid,
  registration_key text,
  event_id text,
  checked_in boolean not null default true,
  checked_in_at timestamptz not null default now(),
  checked_in_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_seats (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  seat_number text not null,
  registration_id uuid,
  assigned_to text,
  status text not null default 'Available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, seat_number)
);

create table if not exists public.kb_attendance (
  id uuid primary key default gen_random_uuid(),
  class_key text not null,
  class_name text not null,
  attendance_date date not null,
  registration_id uuid,
  registration_key text not null,
  student_name text not null,
  family_member text,
  email text,
  status text not null default 'Present',
  notes text,
  taken_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_key, attendance_date, registration_key)
);

create table if not exists public.kb_phone_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_external_logins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  provider text not null,
  provider_key text,
  display_name text,
  created_at timestamptz not null default now(),
  unique(email, provider)
);

create table if not exists public.kb_email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  template text,
  payload jsonb,
  status text not null default 'Stored',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.kb_sms_outbox (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  body text not null,
  payload jsonb,
  status text not null default 'Stored',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.kb_defaulter_history (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  is_defaulter boolean not null default false,
  notes text,
  set_by text,
  created_at timestamptz not null default now()
);

insert into public.kb_event_types (name)
values ('Classroom'), ('Workshop'), ('Seminar'), ('Cultural')
on conflict (name) do nothing;

insert into public.kb_recurrence_options (name)
values ('OneTime'), ('Daily'), ('Weekly'), ('Monthly'), ('Yearly')
on conflict (name) do nothing;

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
alter table public.kb_announcements enable row level security;
alter table public.kb_expenses enable row level security;
alter table public.kb_event_types enable row level security;
alter table public.kb_recurrence_options enable row level security;
alter table public.kb_site_settings enable row level security;
alter table public.kb_member_profiles enable row level security;
alter table public.kb_member_children enable row level security;
alter table public.kb_checkins enable row level security;
alter table public.kb_seats enable row level security;
alter table public.kb_attendance enable row level security;
alter table public.kb_phone_verifications enable row level security;
alter table public.kb_external_logins enable row level security;
alter table public.kb_email_outbox enable row level security;
alter table public.kb_sms_outbox enable row level security;
alter table public.kb_defaulter_history enable row level security;

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

drop policy if exists "Public can read announcements" on public.kb_announcements;
create policy "Public can read announcements"
on public.kb_announcements
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read event types" on public.kb_event_types;
create policy "Public can read event types"
on public.kb_event_types
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read recurrence options" on public.kb_recurrence_options;
create policy "Public can read recurrence options"
on public.kb_recurrence_options
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read site settings" on public.kb_site_settings;
create policy "Public can read site settings"
on public.kb_site_settings
for select
to anon, authenticated
using (true);

insert into public.kb_admins (email, name, active)
values ('ganeshshetty93@gmail.com', 'Kannada Bharati Admin', true)
on conflict (email) do update set active = excluded.active, name = excluded.name;

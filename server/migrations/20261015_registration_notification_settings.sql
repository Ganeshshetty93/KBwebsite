create table if not exists public.kb_site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.kb_site_settings enable row level security;

insert into public.kb_site_settings (key, value)
values (
  'registration-notifications',
  '{"enabled":true,"recipients":"","notifyNewRegistration":true,"notifyPaymentCompleted":true,"reminderEnabled":false,"reminderHours":24}'::jsonb
)
on conflict (key) do nothing;

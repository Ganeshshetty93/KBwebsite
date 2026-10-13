create table if not exists public.kb_newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  status text not null default 'Active',
  source text not null default 'website-footer',
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists kb_newsletter_subscribers_email_lower_idx
on public.kb_newsletter_subscribers (lower(email));

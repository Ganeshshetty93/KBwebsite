create table if not exists public.kb_about_content (
  section text primary key,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.kb_about_content (section, value)
values
  ('currentCommittee', '[]'::jsonb),
  ('sponsors', '[]'::jsonb),
  ('pastCommittees', '[]'::jsonb)
on conflict (section) do nothing;

alter table public.kb_about_content enable row level security;

drop policy if exists "Public can read about content" on public.kb_about_content;
create policy "Public can read about content"
on public.kb_about_content
for select
to anon, authenticated
using (true);

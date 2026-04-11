create table if not exists public.site_content (
  key text primary key,
  content text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.site_content enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'site_content'
      and policyname = 'site_content_public_read_privacy'
  ) then
    create policy site_content_public_read_privacy
      on public.site_content
      for select
      to anon, authenticated
      using (key = 'privacy_policy');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'site_content'
      and policyname = 'site_content_authenticated_upsert'
  ) then
    create policy site_content_authenticated_upsert
      on public.site_content
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

insert into public.site_content (key, content)
values (
  'privacy_policy',
  'Privacy Policy
Effective Date: April 11, 2026
Last Updated: April 11, 2026

At The Black Light, accessible from https://theblacklight.blog, one of our main priorities is the privacy of our visitors.'
)
on conflict (key) do nothing;

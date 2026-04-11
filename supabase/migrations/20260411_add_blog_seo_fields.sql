alter table public.blogs
  add column if not exists seo_title text,
  add column if not exists meta_description text,
  add column if not exists canonical_override_url text;

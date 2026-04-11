insert into public.site_content (key, content)
values (
  'author_profile',
  '{"name": "The Black Light", "bio": "Professional analysis of international economics, global markets, and energy industry trends.", "image_url": "https://www.theblacklight.blog/black_light_logo.png"}'
)
on conflict (key) do nothing;

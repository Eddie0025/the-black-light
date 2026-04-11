import { createClient } from '@supabase/supabase-js';

const SITE_ORIGIN = 'https://theblacklight.blog';

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function buildArticleUrl(post) {
  const overrideUrl = (post.canonical_override_url || '').trim();

  if (overrideUrl) {
    if (/^https?:\/\//i.test(overrideUrl)) return overrideUrl;
    if (overrideUrl.startsWith('/')) return `${SITE_ORIGIN}${overrideUrl}`;
    return `https://${overrideUrl.replace(/^\/+/, '')}`;
  }

  const slug = slugify(post.title) || 'article';
  return `${SITE_ORIGIN}/article/${post.id}-${slug}`;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function handler(_req, res) {
  try {
    const supabase = createClient(
      'https://nxfydodctuvgkgbidfbx.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let blogsResponse = await supabase
      .from('blogs')
      .select('id, title, created_at, updated_at, canonical_override_url')
      .eq('is_archived', false)
      .order('id', { ascending: false });

    if (blogsResponse.error && blogsResponse.error.message.includes('canonical_override_url')) {
      blogsResponse = await supabase
        .from('blogs')
        .select('id, title, created_at, updated_at')
        .eq('is_archived', false)
        .order('id', { ascending: false });
    }

    if (blogsResponse.error) throw blogsResponse.error;
    const blogs = blogsResponse.data;

    const urls = [
      {
        loc: SITE_ORIGIN,
        lastmod: new Date().toISOString(),
        changefreq: 'daily',
        priority: '1.0'
      },
      ...(blogs || []).map(post => ({
        loc: buildArticleUrl(post),
        lastmod: post.updated_at || post.created_at,
        changefreq: 'weekly',
        priority: '0.8'
      }))
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${xmlEscape(url.loc)}</loc>
    <lastmod>${xmlEscape(new Date(url.lastmod).toISOString())}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900');
    return res.status(200).send(xml);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to generate sitemap' });
  }
}

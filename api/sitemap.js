import { createClient } from '@supabase/supabase-js';

const SITE_ORIGIN = 'https://www.theblacklight.blog';
const SUPABASE_URL = 'https://nxfydodctuvgkgbidfbx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Cw6InfjEKF3jLJnc-qGa-Q_uhQu9i9O';

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
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
    );

    let blogs = [];
    let debugErrors = [];

    // Try full query first (with canonical_override_url and is_archived)
    try {
      const { data, error } = await supabase
        .from('blogs')
        .select('id, title, created_at, updated_at, canonical_override_url')
        .eq('is_archived', false)
        .order('id', { ascending: false });

      if (!error && data) {
        blogs = data;
      } else {
        debugErrors.push('Q1: ' + (error?.message || 'no data'));
        throw error;
      }
    } catch (_e1) {
      // Fallback: without canonical_override_url
      try {
        const { data, error } = await supabase
          .from('blogs')
          .select('id, title, created_at, updated_at')
          .eq('is_archived', false)
          .order('id', { ascending: false });

        if (!error && data) {
          blogs = data;
        } else {
          debugErrors.push('Q2: ' + (error?.message || 'no data'));
          throw error;
        }
      } catch (_e2) {
        // Fallback: minimal query (no is_archived filter)
        try {
          const { data, error } = await supabase
            .from('blogs')
            .select('id, title, created_at, updated_at')
            .order('id', { ascending: false });

          if (!error && data) {
            blogs = data;
          } else {
            debugErrors.push('Q3: ' + (error?.message || 'no data'));
            throw error;
          }
        } catch (_e3) {
          debugErrors.push('Q3 catch: ' + (_e3?.message || 'unknown'));
          // Last resort: just return the homepage
          blogs = [];
        }
      }
    }

    const urls = [
      {
        loc: SITE_ORIGIN,
        lastmod: new Date().toISOString(),
        changefreq: 'daily',
        priority: '1.0'
      },
      ...blogs.map(post => ({
        loc: buildArticleUrl(post),
        lastmod: post.updated_at || post.created_at || new Date().toISOString(),
        changefreq: 'weekly',
        priority: '0.8'
      }))
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- debug: found=${blogs.length} errors=${JSON.stringify(debugErrors)} -->
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
    // Even if everything fails, return a valid sitemap with just the homepage
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_ORIGIN}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(fallbackXml);
  }
}

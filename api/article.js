import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SITE_ORIGIN = 'https://www.theblacklight.blog';
const SUPABASE_URL = 'https://nxfydodctuvgkgbidfbx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Cw6InfjEKF3jLJnc-qGa-Q_uhQu9i9O';

export default async function handler(req, res) {
    const slug = req.query.slug || '';
    
    // Default values
    let title = 'The Black Light | Professional Intelligence';
    let description = 'Deep-dive analysis on global macroeconomics, energy markets, and international policy. Illuminating the unseen patterns in global affairs.';
    let imageUrl = `${SITE_ORIGIN}/black_light_logo.png`;
    let canonicalUrl = `${SITE_ORIGIN}/article/${slug}`.replace(/\/+$/, '');
    let ogType = 'article';
    
    // Extract ID from slug
    const match = slug.match(/^(\d+)/);
    if (match) {
        const id = match[1];
        try {
            const supabase = createClient(
                SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
            );
            
            const { data: post, error } = await supabase
                .from('blogs')
                .select('title, excerpt, content, cover_image, seo_title, meta_description, canonical_override_url')
                .eq('id', id)
                .single();
                
            if (error || !post) {
                const indexPath = path.join(process.cwd(), 'public', 'index.html');
                let html = fs.readFileSync(indexPath, 'utf8');
                html = html.replace('</head>', '    <meta name="robots" content="noindex">\n</head>');
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
                return res.status(404).send(html);
            }
                
            if (!error && post) {
                // Determine title
                title = post.seo_title?.trim() || post.title || title;
                title = title + ' | The Black Light';
                
                // Determine description
                const explicitDesc = post.meta_description?.trim();
                if (explicitDesc) {
                    description = explicitDesc;
                } else {
                    const fallbackText = post.excerpt?.trim() || (post.content || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
                    description = fallbackText.length > 160 ? `${fallbackText.substring(0, 157).trimEnd()}...` : fallbackText;
                }
                
                // Image
                if (post.cover_image) imageUrl = post.cover_image;
                
                // Canonical URL
                const overrideUrl = (post.canonical_override_url || '').trim();
                if (overrideUrl) {
                    if (/^https?:\/\//i.test(overrideUrl)) {
                        canonicalUrl = overrideUrl;
                    } else {
                        const overridePath = overrideUrl.startsWith('/') ? overrideUrl.replace(/\/+$/, '') : '/' + overrideUrl.replace(/^\/+/, '').replace(/\/+$/, '');
                        canonicalUrl = `${SITE_ORIGIN}${overridePath}`;
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching article for SEO:', e);
        }
    } else if (!slug) {
        // Fallback
        canonicalUrl = SITE_ORIGIN;
        ogType = 'website';
    }

    try {
        // Read index.html
        const indexPath = path.join(process.cwd(), 'public', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        
        // Ensure no trailing slash for canonical unless it's strictly root
        canonicalUrl = canonicalUrl.replace(/\/+$/, '');
        if (canonicalUrl === 'https://www.theblacklight.blog') {
             // Let it be, the root already has its own logic, but just in case
        }

        // Replace tags securely
        html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
        html = html.replace(/<meta id="meta-desc" name="description" content=".*?">/i, `<meta id="meta-desc" name="description" content="${description.replace(/"/g, '&quot;')}">`);
        html = html.replace(/<meta id="og-title" property="og:title" content=".*?">/i, `<meta id="og-title" property="og:title" content="${title.replace(/"/g, '&quot;')}">`);
        html = html.replace(/<meta id="og-desc" property="og:description" content=".*?">/i, `<meta id="og-desc" property="og:description" content="${description.replace(/"/g, '&quot;')}">`);
        html = html.replace(/<meta id="og-type" property="og:type" content=".*?">/i, `<meta id="og-type" property="og:type" content="${ogType}">`);
        html = html.replace(/<meta id="og-image" property="og:image" content=".*?">/i, `<meta id="og-image" property="og:image" content="${imageUrl}">`);
        html = html.replace(/<meta id="twitter-title" name="twitter:title" content=".*?">/i, `<meta id="twitter-title" name="twitter:title" content="${title.replace(/"/g, '&quot;')}">`);
        html = html.replace(/<meta id="twitter-desc" name="twitter:description" content=".*?">/i, `<meta id="twitter-desc" name="twitter:description" content="${description.replace(/"/g, '&quot;')}">`);
        html = html.replace(/<meta id="twitter-image" name="twitter:image" content=".*?">/i, `<meta id="twitter-image" name="twitter:image" content="${imageUrl}">`);
        html = html.replace(/<meta id="og-url" property="og:url".*?>/i, `<meta id="og-url" property="og:url" content="${canonicalUrl}">`);
        
        // Canonical tags matching
        if (html.includes('<link id="canonical-url" rel="canonical">')) {
            html = html.replace('<link id="canonical-url" rel="canonical">', `<link id="canonical-url" rel="canonical" href="${canonicalUrl}">`);
        } else {
            html = html.replace(/<link id="canonical-url" rel="canonical" href=".*?">/i, `<link id="canonical-url" rel="canonical" href="${canonicalUrl}">`);
        }

        // SSR Pre-render styles to immediately hide home view and show article shell for Googlebot
        const preRenderCss = `
        <style id="seo-prerender-style">
            #home-view { display: none !important; }
            #article-view { display: block !important; }
        </style>
        `;
        html = html.replace('</head>', `${preRenderCss}\n</head>`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
        res.status(200).send(html);
    } catch (e) {
        console.error('Error serving article HTML:', e);
        res.status(500).send('Internal Server Error');
    }
}

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  'https://nxfydodctuvgkgbidfbx.supabase.co', 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { record, type } = req.body;
  const { title, id, category } = record || {};

  // ONLY broadcast on new article creation. Ignore updates (edits).
  if (type !== 'INSERT') {
    return res.status(200).json({ message: 'Broadcast skipped: Not an INSERT event' });
  }

  if (!title || !id) {
    return res.status(400).json({ error: 'Incomplete record data' });
  }

  const slugify = (text) => (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  const reportUrl = `https://www.theblacklight.blog/article/${id}-${slugify(title)}`;

  try {
    // 1. Fetch all subscribers
    const { data: subscribers, error: subError } = await supabase
      .from('subscribers')
      .select('email');

    if (subError) throw subError;
    if (!subscribers || subscribers.length === 0) {
      return res.status(200).json({ message: 'No subscribers to notify' });
    }

    // 2. Blast the intelligence alert (Individual sends for privacy and unsubscribe links)
    const results = await Promise.all(subscribers.map(sub => 
      resend.emails.send({
        from: 'The Black Light <briefings@www.theblacklight.blog>',
        to: [sub.email],
        reply_to: 'theblacklighttt@gmail.com',
        subject: `BRIEFING: ${title} | The Black Light`,
        html: `
          <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #08080a; color: #fcfcfc; padding: 60px 40px; border-radius: 4px; max-width: 600px; margin: 0 auto; border: 1px solid #1a1a20;">
            <div style="margin-bottom: 48px; border-bottom: 2px solid #c084fc; width: 40px;"></div>
            
            <h1 style="color: #fcfcfc; font-size: 32px; line-height: 1.15; font-weight: 800; margin-bottom: 24px; letter-spacing: -0.03em;">${title}</h1>
            
            <div style="margin-bottom: 32px; display: flex; gap: 12px; align-items: center;">
              <span style="color: #c084fc; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em;">${category || 'Analytical Intelligence'}</span>
            </div>

            <p style="color: #94a3b8; font-size: 16px; line-height: 1.7; margin-bottom: 40px;">
              Our latest analytical briefing has been finalized. We provide deep-dive insights and strategic projections on the evolving situation in the <strong>${category || 'General'}</strong> sector.
            </p>
            
            <a href="${reportUrl}" style="display: inline-block; background-color: #ffffff; color: #000000; padding: 16px 40px; border-radius: 2px; text-decoration: none; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Access Full Briefing</a>
            
            <div style="margin-top: 80px; padding-top: 32px; border-top: 1px solid #1a1a20; color: #475569; font-size: 11px; line-height: 1.8; letter-spacing: 0.02em;">
              <p style="margin-bottom: 12px;">This document is intended for the registered recipient. Confidentiality and strategic discretion are advised.</p>
              <p style="margin-bottom: 12px; text-transform: uppercase;">&copy; 2026 The Black Light | Global Strategy & Macro Analysis</p>
              <p style="margin: 0;">
                <a href="https://www.theblacklight.blog/unsubscribe.html?email=${encodeURIComponent(sub.email)}" style="color: #64748b; text-decoration: underline;">Unsubscribe from network</a>
              </p>
            </div>
          </div>
        `,
      })
    ));

    return res.status(200).json({ success: true, count: results.length });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

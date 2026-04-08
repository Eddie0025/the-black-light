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

  const { record } = req.body;
  const { title, id, category } = record;

  if (!title || !id) {
    return res.status(400).json({ error: 'Incomplete record data' });
  }

  try {
    // 1. Fetch all subscribers
    const { data: subscribers, error: subError } = await supabase
      .from('subscribers')
      .select('email');

    if (subError) throw subError;
    if (!subscribers || subscribers.length === 0) {
      return res.status(200).json({ message: 'No subscribers to notify' });
    }

    const recipientEmails = subscribers.map(s => s.email);
    const reportUrl = `https://theblacklight.blog/?id=${id}`;

    // 2. Blast the intelligence alert
    const data = await resend.emails.send({
      from: 'The Black Light <briefings@theblacklight.blog>',
      to: recipientEmails,
      reply_to: 'theblacklighttt@gmail.com',
      subject: `BRIEFING: ${title} | The Black Light`,
      html: `
        <div style="font-family: 'Inter', system-ui, sans-serif; background-color: #08080a; color: #fcfcfc; padding: 60px 40px; border-radius: 4px; max-width: 600px; margin: 0 auto;">
          <div style="margin-bottom: 32px;">
            <span style="background: rgba(192, 132, 252, 0.1); color: #c084fc; padding: 6px 12px; border-radius: 2px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Latest Intelligence Briefing</span>
          </div>
          
          <h1 style="color: #fcfcfc; font-size: 28px; line-height: 1.25; font-weight: 800; margin-bottom: 24px; letter-spacing: -0.01em;">${title}</h1>
          <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin-bottom: 40px;">
            A new analytical report has been published in the <strong>${category || 'General'}</strong> sector. We invite you to review the latest findings and strategic updates.
          </p>
          
          <a href="${reportUrl}" style="display: inline-block; background-color: #c084fc; color: #ffffff; padding: 14px 32px; border-radius: 4px; text-decoration: none; font-weight: 700; font-size: 14px;">Access Full Report</a>
          
          <div style="margin-top: 60px; padding-top: 32px; border-top: 1px solid #1a1a20; color: #64748b; font-size: 12px; line-height: 1.6;">
            <p style="margin-bottom: 8px;">You are receiving this briefing as a registered subscriber to The Black Light network.</p>
            <p style="margin: 0;">&copy; 2026 The Black Light | Strategy & Macro Intelligence</p>
          </div>
        </div>
      `,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

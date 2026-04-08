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
      from: 'Intel Alert <intel@theblacklight.blog>',
      to: recipientEmails,
      reply_to: 'theblacklighttt@gmail.com',
      subject: `ALERT: ${title} | New Intelligence Log`,
      html: `
        <div style="font-family: sans-serif; background-color: #08080a; color: #fcfcfc; padding: 40px; border-radius: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
            <span style="background: rgba(192, 132, 252, 0.1); color: #c084fc; padding: 4px 10px; border-radius: 50px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">New Briefing</span>
          </div>
          <h1 style="color: #fcfcfc; font-size: 2rem; line-height: 1.2; margin-bottom: 10px;">${title}</h1>
          <p style="color: #94a3b8; font-size: 1.1rem; margin-bottom: 30px;">A new intelligence report has been declassified in the <strong>${category || 'General'}</strong> sector.</p>
          
          <a href="${reportUrl}" style="display: inline-block; background-color: #c084fc; color: #fff; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-bottom: 40px;">Access Initial Briefing</a>
          
          <div style="border-top: 1px solid #1a1a20; padding-top: 20px; color: #555; font-size: 0.8rem;">
            <p>You are receiving this because you are part of The Black Light intelligence network.</p>
            <p>&copy; 2026 The Black Light | Intelligence Division</p>
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

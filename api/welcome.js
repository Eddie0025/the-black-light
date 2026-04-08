import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { record } = req.body;
  const email = record?.email;

  if (!email) {
    return res.status(400).json({ error: 'No email found in record' });
  }

  try {
    const data = await resend.emails.send({
      from: 'The Black Light <briefings@theblacklight.blog>',
      to: [email],
      reply_to: 'theblacklighttt@gmail.com',
      subject: 'Subscription Confirmed | The Black Light',
      html: `
        <div style="font-family: 'Inter', system-ui, sans-serif; background-color: #08080a; color: #fcfcfc; padding: 60px 40px; border-radius: 4px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #fcfcfc; font-size: 24px; font-weight: 800; margin-bottom: 24px; letter-spacing: -0.02em;">Welcome to The Black Light.</h1>
          <p style="font-size: 16px; line-height: 1.6; color: #94a3b8; margin-bottom: 32px;">
            Thank you for joining our community. Your subscription has been successfully processed. 
          </p>
          <div style="background: #111115; padding: 32px; border-left: 2px solid #c084fc; margin-bottom: 32px;">
            <p style="margin: 0; color: #fcfcfc; font-size: 15px; line-height: 1.6;">
              You will now receive regular briefings on global macroeconomics, energy markets, and international policy. Our goal is to provide deep-dive analysis that cuts through the noise of traditional media.
            </p>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #64748b;">
            All reports are distributed directly to your inbox as they are published. You can also access our full archive at any time through our digital platform.
          </p>
          <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #1a1a20;">
            <p style="font-size: 12px; color: #475569; margin: 0; line-height: 1.6;">
              &copy; 2026 The Black Light | Analytical Intelligence & Strategy<br>
              <a href="https://theblacklight.blog/unsubscribe.html?email=${encodeURIComponent(email)}" style="color: #64748b; text-decoration: underline; margin-top: 8px; display: inline-block;">Unsubscribe from our network</a>
            </p>
          </div>

        </div>
      `,
    });

    return res.status(200).json(data);
  } catch (error) {
    return res.status(400).json(error);
  }
}

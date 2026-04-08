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
      from: 'Intel Hub <intel@theblacklight.blog>',
      to: [email],
      reply_to: 'theblacklighttt@gmail.com',
      subject: 'Operational Access Granted | The Black Light',
      html: `
        <div style="font-family: sans-serif; background-color: #08080a; color: #fcfcfc; padding: 40px; border-radius: 10px;">
          <h1 style="color: #c084fc; border-bottom: 1px solid #1a1a20; padding-bottom: 10px;">Operational Access Granted</h1>
          <p style="font-size: 1.1rem; line-height: 1.6;">Welcome to the network.</p>
          <p style="color: #94a3b8;">Your subscription to <strong>The Black Light</strong> intelligence reports has been successfully authenticated. You are now cleared to receive high-level briefings on global macroeconomics and market intelligence.</p>
          <div style="margin-top: 30px; padding: 20px; background: #111115; border-radius: 8px; border: 1px solid #1a1a20;">
            <p style="margin: 0; color: #c084fc; font-weight: bold;">Security Protocol:</p>
            <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #94a3b8;">Expect regular updates as global patterns shift. All communications are intended for the recipient only.</p>
          </div>
          <p style="margin-top: 40px; font-size: 0.8rem; color: #555;">&copy; 2026 The Black Light | Intelligence Division</p>
        </div>
      `,
    });

    return res.status(200).json(data);
  } catch (error) {
    return res.status(400).json(error);
  }
}

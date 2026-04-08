import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nxfydodctuvgkgbidfbx.supabase.co', 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const { error } = await supabase
      .from('subscribers')
      .delete()
      .eq('email', email);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Successfully unsubscribed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

import dns from 'node:dns/promises';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // 1. Basic Regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const [, domain] = email.split('@');

  // 2. Block Disposable Domains
  const disposableDomains = [
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com', 
    'throwawaymail.com', 'yopmail.com', 'maildrop.cc', 'dispostable.com'
  ];
  
  if (disposableDomains.includes(domain.toLowerCase())) {
    return res.status(400).json({ error: 'Disposable email addresses are not allowed' });
  }

  // 3. MX Record Lookup
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return res.status(400).json({ error: 'Domain does not have valid mail servers' });
    }
  } catch (error) {
    // If ENOTFOUND or ENODATA, it's definitely fake. 
    // Other errors might be network issues, but for "authenticity" we prefer strictness.
    return res.status(400).json({ error: 'Email domain is unreachable or invalid' });
  }

  return res.status(200).json({ valid: true });
}

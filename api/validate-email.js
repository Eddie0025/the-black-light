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

  const [localPart, domain] = email.split('@');
  const lowerDomain = domain.toLowerCase();
  const lowerLocal = localPart.toLowerCase();

  // 2. Block Disposable Domains (Expanded)
  const disposableDomains = [
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com', 
    'throwawaymail.com', 'yopmail.com', 'maildrop.cc', 'dispostable.com',
    'sharklasers.com', 'getnada.com', 'mohmal.com', 'tmail.ws', 'mail.tm'
  ];
  
  if (disposableDomains.includes(lowerDomain)) {
    return res.status(400).json({ error: 'Disposable email addresses are strictly prohibited for intellectual security.' });
  }

  // 3. Gmail Specific "Unreal" Checks
  if (lowerDomain === 'gmail.com') {
    // Check for "dot stuffing" (e.g., u.s.e.r.n.a.m.e@gmail.com)
    const dotCount = (lowerLocal.match(/\./g) || []).length;
    if (dotCount > 3) {
      return res.status(400).json({ error: 'Suspicious email pattern detected.' });
    }

    // Check for "+" aliases (e.g., user+spam@gmail.com)
    if (lowerLocal.includes('+')) {
      return res.status(400).json({ error: 'Email aliases are not permitted in this network.' });
    }
  }

  // 4. Entropy / Bot Pattern Heuristics
  // Block very short local parts for common domains
  if (lowerLocal.length < 4 && ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(lowerDomain)) {
    return res.status(400).json({ error: 'Email address appears insufficient.' });
  }

  // Block obvious keyboard mashes (e.g., asdf, qwer, zxcv)
  const mashes = ['asdf', 'qwer', 'zxcv', 'jkl;', 'testtest'];
  if (mashes.some(m => lowerLocal.includes(m))) {
    return res.status(400).json({ error: 'Please use a legitimate professional email address.' });
  }

  // 5. MX Record Lookup
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return res.status(400).json({ error: 'Domain does not have valid mail servers.' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Email domain is unreachable or invalid.' });
  }

  return res.status(200).json({ valid: true });
}

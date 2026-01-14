// Server-side admin login for Vercel
// POST { password }
// Requires two environment variables set in Vercel:
// - ADMIN_PASSWORD_HASH (sha256 hex of the admin password)
// - SESSION_SECRET (a random secret string used to sign session tokens)

import crypto from 'crypto';

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signToken(payloadObj, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB = base64url(JSON.stringify(header));
  const payloadB = base64url(JSON.stringify(payloadObj));
  const sig = crypto.createHmac('sha256', secret).update(`${headerB}.${payloadB}`).digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${headerB}.${payloadB}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB, payloadB, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${headerB}.${payloadB}`).digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB, 'base64').toString());
    return payload;
  } catch (e) {
    return null;
  }
}

// CORS helper for cross-origin requests from GitHub Pages
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://cheekypubs.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });

  const configuredHash = process.env.ADMIN_PASSWORD_HASH || '';
  const providedHash = sha256Hex(password);

  // Timing-safe compare
  let safeEqual = false;
  try {
    safeEqual = crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(configuredHash));
  } catch (e) {
    safeEqual = false;
  }
  if (!safeEqual) return res.status(401).json({ error: 'invalid credentials' });

  const sessionSecret = process.env.SESSION_SECRET || '';
  if (!sessionSecret) return res.status(500).json({ error: 'server misconfigured' });

  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 60 * 60 }; // 1 hour session
  const token = signToken(payload, sessionSecret);

  // Set HttpOnly secure cookie (SameSite=None for cross-origin)
  const cookie = `session=${token}; HttpOnly; Path=/; Max-Age=${60 * 60}; SameSite=None; Secure`;
  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ status: 'ok' });
}

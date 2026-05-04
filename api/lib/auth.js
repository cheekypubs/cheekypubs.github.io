// Shared authentication helpers for Vercel serverless functions

import crypto from 'crypto';

/**
 * Set CORS headers for cross-origin requests from GitHub Pages
 */
export function setCorsHeaders(res, req) {
  const allowed = ['https://cheeky.pub', 'http://localhost:4000', 'http://127.0.0.1:4000'];
  const origin = req && req.headers && req.headers.origin ? req.headers.origin : '';
  const allowedOrigin = allowed.includes(origin) ? origin : 'https://cheeky.pub';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/**
 * Extract JWT from Authorization header (preferred) or session cookie (fallback)
 */
function extractToken(req) {
  const authHeader = req.headers?.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieHeader = req.headers?.cookie || '';
  const sessionCookie = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith('session='));
  return bearerToken || (sessionCookie ? sessionCookie.split('=')[1] : null);
}

/**
 * Verify a JWT session token.
 * Returns true if the token is valid and not expired, false otherwise.
 */
export function verifySession(req) {
  const token = extractToken(req);
  const sessionSecret = process.env.SESSION_SECRET || process.env.GITHUB_PAT || '';

  if (!token || !sessionSecret) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerB, payloadB, sig] = parts;

  try {
    const expected = crypto.createHmac('sha256', sessionSecret)
      .update(`${headerB}.${payloadB}`)
      .digest('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (sig !== expected) return false;

    const payload = JSON.parse(Buffer.from(payloadB, 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Middleware-style guard: returns 401 response if session is invalid.
 * Returns true if request should be rejected, false if authenticated.
 * Usage:
 *   if (rejectUnauthenticated(req, res)) return;
 */
export function rejectUnauthenticated(req, res) {
  if (!verifySession(req)) {
    res.status(401).json({ error: 'unauthenticated' });
    return true;
  }
  return false;
}

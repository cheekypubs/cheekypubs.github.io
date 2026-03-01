// Vercel Serverless Function: api/get-story-content.js
// Accepts POST { slug } and returns markdown for _stories/<slug>.md

import crypto from 'crypto';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://cheeky.pub');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function verifySession(req) {
  const authHeader = req.headers?.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieHeader = req.headers?.cookie || '';
  const sessionCookie = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith('session='));
  const token = bearerToken || (sessionCookie ? sessionCookie.split('=')[1] : null);
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

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifySession(req)) {
    return res.status(401).json({ error: 'unauthenticated' });
  }

  const body = req.body || {};
  const slug = (body.slug || '').toString().trim();

  if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  const owner = 'cheekypubs';
  const repo = 'cheekypubs.github.io';
  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  const path = `_stories/${slug}.md`;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

  try {
    const ghResp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!ghResp.ok) {
      const text = await ghResp.text();
      return res.status(ghResp.status).json({ error: 'Could not fetch story', detail: text });
    }

    const data = await ghResp.json();
    const base64 = (data.content || '').replace(/\n/g, '');
    const content = Buffer.from(base64, 'base64').toString('utf8');

    return res.status(200).json({ content });
  } catch (err) {
    console.error('Error fetching story content', err);
    return res.status(502).json({ error: 'Failed to fetch story content' });
  }
}

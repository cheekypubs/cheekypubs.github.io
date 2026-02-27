// Vercel Serverless Function: api/edit-story.js
// Accepts POST { filepath, title, content, tags } and triggers a repository_dispatch

import crypto from 'crypto';

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

  // Require admin session cookie
  const cookieHeader = req.headers?.cookie || '';
  const sessionCookie = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith('session='));
  const token = sessionCookie ? sessionCookie.split('=')[1] : null;
  const sessionSecret = process.env.SESSION_SECRET || '';
  if (!token || !sessionSecret) return res.status(401).json({ error: 'unauthenticated' });

  // Verify token
  const parts = token.split('.');
  if (parts.length !== 3) return res.status(401).json({ error: 'invalid session' });
  const [headerB, payloadB, sig] = parts;
  try {
    const expected = crypto.createHmac('sha256', sessionSecret).update(`${headerB}.${payloadB}`).digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (sig !== expected) return res.status(401).json({ error: 'invalid session' });
    const payload = JSON.parse(Buffer.from(payloadB, 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return res.status(401).json({ error: 'session expired' });
  } catch (e) {
    return res.status(401).json({ error: 'invalid session' });
  }

  const body = req.body || {};
  const filepath = (body.filepath || '').toString().trim();
  const title = (body.title || '').toString().trim();
  const content = (body.content || '').toString();
  const tags = Array.isArray(body.tags) ? body.tags : (body.tags ? String(body.tags).split(',').map(s => s.trim()) : []);

  if (!filepath || !title || !content) {
    return res.status(400).json({ error: 'filepath, title and content are required' });
  }

  // Validate filepath to prevent directory traversal
  if (!filepath.startsWith('_stories/') || filepath.includes('..') || filepath.includes('\0')) {
    return res.status(400).json({ error: 'invalid filepath' });
  }

  const owner = 'cheekypubs';
  const repo = 'cheekypubs.github.io';
  const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`;

  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  const payload = {
    event_type: 'story-edit',
    client_payload: { filepath, title, content, tags }
  };

  try {
    const ghResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (ghResp.status === 204) {
      return res.status(200).json({ status: 'ok' });
    }

    const text = await ghResp.text();
    return res.status(502).json({ error: `GitHub API error: ${ghResp.status}`, detail: text });

  } catch (err) {
    console.error('Error calling GitHub API', err);
    return res.status(502).json({ error: 'Failed to call GitHub API' });
  }
}

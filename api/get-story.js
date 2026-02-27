// Vercel Serverless Function: api/get-story.js
// Accepts GET ?path=_stories/filename.md and returns the raw story content from GitHub

import crypto from 'crypto';

// CORS helper for cross-origin requests from GitHub Pages
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://cheekypubs.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
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

  const filePath = req.query?.path;
  if (!filePath) return res.status(400).json({ error: 'path query parameter is required' });

  // Validate path to prevent directory traversal
  if (!filePath.startsWith('_stories/') || filePath.includes('..') || filePath.includes('\0')) {
    return res.status(400).json({ error: 'invalid path' });
  }

  const owner = 'cheekypubs';
  const repo = 'cheekypubs.github.io';
  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  try {
    const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!ghResp.ok) {
      const text = await ghResp.text();
      return res.status(ghResp.status).json({ error: `GitHub API error: ${ghResp.status}`, detail: text });
    }

    const data = await ghResp.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return res.status(200).json({ content, sha: data.sha });

  } catch (err) {
    console.error('Error fetching story from GitHub', err);
    return res.status(502).json({ error: 'Failed to fetch story content' });
  }
}

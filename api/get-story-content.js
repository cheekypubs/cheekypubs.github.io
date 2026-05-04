// Vercel Serverless Function: api/get-story-content.js
// Accepts POST { slug } and returns markdown for _stories/<slug>.md

import { setCorsHeaders, rejectUnauthenticated } from './lib/auth.js';

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rejectUnauthenticated(req, res)) return;

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
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/_stories/${encodeURIComponent(slug)}.md`;

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

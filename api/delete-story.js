// Vercel Serverless Function: api/delete-story.js
// Accepts POST { storyUrl }
// and triggers a repository_dispatch event to delete the story via GitHub Actions

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
  const storyUrl = (body.storyUrl || '').toString().trim();

  if (!storyUrl) {
    return res.status(400).json({ error: 'storyUrl is required' });
  }

  const owner = 'cheekypubs';
  const repo = 'cheekypubs.github.io';
  const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`;

  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  const dispatchPayload = {
    event_type: 'story-delete',
    client_payload: { storyUrl }
  };

  try {
    const ghResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dispatchPayload)
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

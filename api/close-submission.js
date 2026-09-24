// Vercel Serverless Function: api/close-submission.js
// Admin-authenticated. Closes a pending-submission issue after it's been
// published or rejected from the admin Submissions tab.
// Accepts POST { issueNumber, action: 'published' | 'rejected', reason }

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
  const issueNumber = parseInt(body.issueNumber, 10);
  const action = body.action === 'rejected' ? 'rejected' : 'published';
  const reason = (body.reason || '').toString().trim();

  if (!Number.isFinite(issueNumber)) {
    return res.status(400).json({ error: 'issueNumber is required' });
  }

  const owner = 'cheekypubs';
  const repo = 'cheekypubs.github.io';
  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  const commentBody = action === 'published'
    ? '✅ This submission has been published to the site.'
    : `❌ This submission was not published.${reason ? `\n\nReason: ${reason}` : ''}`;

  try {
    await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body: commentBody })
    });

    const closeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: 'closed',
        labels: [action === 'published' ? 'submission-published' : 'submission-rejected']
      })
    });

    if (!closeResp.ok) {
      const text = await closeResp.text();
      return res.status(502).json({ error: `GitHub API error: ${closeResp.status}`, detail: text });
    }

    return res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error('Error calling GitHub API', err);
    return res.status(502).json({ error: 'Failed to call GitHub API' });
  }
}

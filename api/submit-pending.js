// Vercel Serverless Function: api/submit-pending.js
// Public endpoint. Accepts POST { title, author, tags, description, content, email, website, turnstileToken }
// Validates spam protections, then creates a GitHub Issue as a pending submission
// for an admin to review and publish from the Submissions tab in /admin/.

import { setCorsHeaders } from './lib/auth.js';

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // If no secret is configured, skip verification rather than hard-failing
  // every submission (lets the honeypot carry spam protection alone until
  // Turnstile is set up).
  if (!secret) return true;
  if (!token) return false;

  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip || '' })
    });
    const data = await resp.json();
    return !!data.success;
  } catch (err) {
    console.error('Turnstile verification failed', err);
    return false;
  }
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // Honeypot: a hidden field real visitors never fill in. Any value means bot.
  if ((body.website || '').toString().trim() !== '') {
    // Respond as if successful so bots don't learn to avoid the honeypot.
    return res.status(200).json({ status: 'ok' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
  const turnstileOk = await verifyTurnstile(body.turnstileToken, ip);
  if (!turnstileOk) {
    return res.status(400).json({ error: 'Spam verification failed. Please try again.' });
  }

  const title = (body.title || '').toString().trim();
  const author = (body.author || 'Anonymous').toString().trim();
  const content = (body.content || '').toString().trim();
  const description = (body.description || '').toString().trim();
  const email = (body.email || '').toString().trim();
  const tags = Array.isArray(body.tags)
    ? body.tags
    : (body.tags ? String(body.tags).split(',').map(s => s.trim()).filter(Boolean) : []);

  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }
  if (title.length > 200) {
    return res.status(400).json({ error: 'title is too long' });
  }
  if (content.length > 200000) {
    return res.status(400).json({ error: 'content is too long' });
  }

  const owner = 'cheekypubs';
  const repo = 'cheekypubs.github.io';
  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  const bodyLines = [
    `**Title:** ${title}`,
    `**Author:** ${author}`,
    `**Tags:** ${tags.join(', ') || '_none_'}`,
    email ? `**Contact email:** ${email}` : null,
    description ? `\n**Description:**\n${description}` : null,
    '\n### Content',
    '```markdown',
    content,
    '```'
  ].filter(Boolean);

  try {
    const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `[Pending Submission] ${title}`,
        body: bodyLines.join('\n'),
        labels: ['pending-submission']
      })
    });

    if (ghResp.ok) {
      return res.status(200).json({ status: 'ok' });
    }

    const text = await ghResp.text();
    return res.status(502).json({ error: `GitHub API error: ${ghResp.status}`, detail: text });

  } catch (err) {
    console.error('Error calling GitHub API', err);
    return res.status(502).json({ error: 'Failed to call GitHub API' });
  }
}

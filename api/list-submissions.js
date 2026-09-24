// Vercel Serverless Function: api/list-submissions.js
// Admin-authenticated. Returns open GitHub issues labeled "pending-submission"
// parsed into structured fields for the admin Submissions tab.

import { setCorsHeaders, rejectUnauthenticated } from './lib/auth.js';

function parseIssueBody(body) {
  const titleMatch = body.match(/\*\*Title:\*\* (.+)/);
  const authorMatch = body.match(/\*\*Author:\*\* (.+)/);
  const tagsMatch = body.match(/\*\*Tags:\*\* (.+)/);
  const emailMatch = body.match(/\*\*Contact email:\*\* (.+)/);
  const descriptionMatch = body.match(/\*\*Description:\*\*\n([\s\S]*?)\n\n### Content/);
  const contentMatch = body.match(/### Content\s*\n```markdown\s*\n([\s\S]*?)\n```/);

  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    author: authorMatch ? authorMatch[1].trim() : 'Anonymous',
    tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()).filter(t => t && t !== '_none_') : [],
    email: emailMatch ? emailMatch[1].trim() : '',
    description: descriptionMatch ? descriptionMatch[1].trim() : '',
    content: contentMatch ? contentMatch[1].trim() : ''
  };
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rejectUnauthenticated(req, res)) return;

  const owner = 'cheekypubs';
  const repo = 'cheekypubs.github.io';
  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  try {
    const ghResp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=open&labels=pending-submission&per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github+json'
        }
      }
    );

    if (!ghResp.ok) {
      const text = await ghResp.text();
      return res.status(502).json({ error: `GitHub API error: ${ghResp.status}`, detail: text });
    }

    const issues = await ghResp.json();
    const submissions = issues
      .filter(issue => !issue.pull_request)
      .map(issue => ({
        issueNumber: issue.number,
        createdAt: issue.created_at,
        ...parseIssueBody(issue.body || '')
      }));

    return res.status(200).json({ submissions });

  } catch (err) {
    console.error('Error calling GitHub API', err);
    return res.status(502).json({ error: 'Failed to call GitHub API' });
  }
}

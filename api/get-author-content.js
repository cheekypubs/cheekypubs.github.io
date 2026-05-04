// Vercel Serverless Function: api/get-author-content.js
// Accepts POST { slug } and returns the author page frontmatter fields.

import { setCorsHeaders, rejectUnauthenticated } from './lib/auth.js';

const OWNER = 'cheekypubs';
const REPO = 'cheekypubs.github.io';

function ghHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };
}

async function getGitHubFile(token, filePath) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath)}`;
  const resp = await fetch(url, { headers: ghHeaders(token) });
  if (!resp.ok) return null;
  const data = await resp.json();
  return {
    content_utf8: Buffer.from(data.content, 'base64').toString('utf8'),
    sha: data.sha
  };
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rejectUnauthenticated(req, res)) return;

  const slug = ((req.body || {}).slug || '').toString().trim().replace(/[^a-z0-9-]/g, '');
  if (!slug) return res.status(400).json({ error: 'slug required' });

  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  const filePath = `pages/authors/${slug}.md`;
  const file = await getGitHubFile(ghToken, filePath);
  if (!file) return res.status(404).json({ error: 'Author file not found' });

  return res.status(200).json({ content: file.content_utf8 });
}

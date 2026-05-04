// Vercel Serverless Function: api/edit-author.js
// Accepts POST { slug, bio, photo, amazon_author_url, ku_titles }
// and writes the updated author page to GitHub via the Contents API.

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

async function putGitHubFile(token, filePath, content_utf8, sha, message) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath)}`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify({
      message,
      content: Buffer.from(content_utf8).toString('base64'),
      sha,
      branch: 'main'
    })
  });
  return resp.ok;
}

function esc(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getYamlValue(yaml, key) {
  // Double-quoted value (allows apostrophes)
  let match = yaml.match(new RegExp(`^${key}:\\s*"([^"]*)"`, 'm'));
  if (match) return match[1];
  // Unquoted fallback
  match = yaml.match(new RegExp(`^${key}:\\s*([^"'\\n][^\\n]*)`, 'm'));
  return match ? match[1].trim() : '';
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rejectUnauthenticated(req, res)) return;

  const body = req.body || {};
  const slug = (body.slug || '').toString().trim().replace(/[^a-z0-9-]/g, '');
  if (!slug) return res.status(400).json({ error: 'slug required' });

  const bio = (body.bio || '').toString().trim();
  const photo = (body.photo || '').toString().trim();
  const amazon_author_url = (body.amazon_author_url || '').toString().trim();
  const ku_titles = Array.isArray(body.ku_titles) ? body.ku_titles : [];

  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  const filePath = `pages/authors/${slug}.md`;
  const existing = await getGitHubFile(ghToken, filePath);
  if (!existing) return res.status(404).json({ error: 'Author file not found' });

  // Parse existing frontmatter to preserve layout/title/author/permalink
  const fmMatch = existing.content_utf8.match(/^---\s*\n([\s\S]*?)\n---/);
  const existingYaml = fmMatch ? fmMatch[1] : '';

  const layout = getYamlValue(existingYaml, 'layout') || 'author';
  const title = getYamlValue(existingYaml, 'title') || `Stories by ${slug}`;
  const author = getYamlValue(existingYaml, 'author') || slug;
  const permalink = getYamlValue(existingYaml, 'permalink') || `/pages/authors/${slug}/`;

  let frontmatter = `---\nlayout: ${layout}\ntitle: "${esc(title)}"\nauthor: "${esc(author)}"\npermalink: ${permalink}\n`;

  if (bio) frontmatter += `bio: "${esc(bio)}"\n`;
  if (photo) frontmatter += `photo: "${esc(photo)}"\n`;
  if (amazon_author_url) frontmatter += `amazon_author_url: "${esc(amazon_author_url)}"\n`;

  if (ku_titles.length > 0) {
    frontmatter += 'ku_titles:\n';
    for (const book of ku_titles) {
      const bookTitle = (book.title || '').toString().trim();
      const bookUrl = (book.amazon_url || '').toString().trim();
      const bookCover = (book.cover || '').toString().trim();
      const bookDesc = (book.description || '').toString().trim();
      if (!bookTitle || !bookUrl) continue;
      frontmatter += `  - title: "${esc(bookTitle)}"\n`;
      frontmatter += `    amazon_url: "${esc(bookUrl)}"\n`;
      if (bookCover) frontmatter += `    cover: "${esc(bookCover)}"\n`;
      if (bookDesc) frontmatter += `    description: "${esc(bookDesc)}"\n`;
    }
  }

  frontmatter += '---\n';

  const ok = await putGitHubFile(
    ghToken,
    filePath,
    frontmatter,
    existing.sha,
    `Update author profile: ${author.replace(/[`$\\"\n\r]/g, '')}`
  );

  if (!ok) return res.status(502).json({ error: 'Failed to update author file on GitHub' });

  return res.status(200).json({ status: 'ok' });
}

// Vercel Serverless Function: api/edit-story.js
// Accepts POST { storyUrl, title, author, date, tags, description, artImage, storyId, chapter, chapterTitle, content }
// and writes the updated story file directly to GitHub via the Contents API.

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

async function listGitHubDir(token, dirPath) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(dirPath)}`;
  const resp = await fetch(url, { headers: ghHeaders(token) });
  if (!resp.ok) return [];
  return resp.json();
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

function getYamlValue(yaml, key) {
  const regex = new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm');
  const match = yaml.match(regex);
  return match ? match[1].trim() : '';
}

function escapeYamlString(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function splitFrontMatter(fileContent) {
  const match = fileContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2] || '' };
}

async function inheritSeriesArtwork(token, storyId, currentFilePath) {
  if (!storyId) return '';
  const files = await listGitHubDir(token, '_stories');
  const candidates = [];
  for (const file of files.filter(f => f.type === 'file' && f.name.endsWith('.md') && f.path !== currentFilePath)) {
    try {
      const data = await getGitHubFile(token, file.path);
      if (!data) continue;
      const parsed = splitFrontMatter(data.content_utf8);
      if (!parsed) continue;
      if (getYamlValue(parsed.yaml, 'story_id') !== storyId) continue;
      const image = getYamlValue(parsed.yaml, 'art_image');
      if (!image) continue;
      const chapterValue = parseInt(getYamlValue(parsed.yaml, 'chapter'), 10);
      candidates.push({ chapter: Number.isFinite(chapterValue) ? chapterValue : Number.MAX_SAFE_INTEGER, image });
    } catch (e) { /* skip */ }
  }
  if (candidates.length === 0) return '';
  candidates.sort((a, b) => a.chapter - b.chapter);
  return candidates[0].image;
}

async function propagateSeriesArtwork(token, storyId, currentFilePath, artImage) {
  if (!storyId || !artImage) return;
  const files = await listGitHubDir(token, '_stories');
  for (const file of files.filter(f => f.type === 'file' && f.name.endsWith('.md') && f.path !== currentFilePath)) {
    try {
      const data = await getGitHubFile(token, file.path);
      if (!data) continue;
      const parsed = splitFrontMatter(data.content_utf8);
      if (!parsed) continue;
      if (getYamlValue(parsed.yaml, 'story_id') !== storyId) continue;
      if (getYamlValue(parsed.yaml, 'art_image') === artImage) continue;
      let newYaml;
      if (/^art_image:/m.test(parsed.yaml)) {
        newYaml = parsed.yaml.replace(/^art_image:.*$/m, `art_image: "${escapeYamlString(artImage)}"`);
      } else {
        newYaml = `${parsed.yaml}\nart_image: "${escapeYamlString(artImage)}"`;
      }
      const newContent = `---\n${newYaml}\n---\n\n${parsed.body.replace(/^\n+/, '')}\n`;
      await putGitHubFile(token, file.path, newContent, data.sha, `Update artwork for series: ${storyId}`);
    } catch (e) { /* skip */ }
  }
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rejectUnauthenticated(req, res)) return;

  const body = req.body || {};
  const rawUrl = (body.storyUrl || '').toString().trim().replace(/^\/|\/$/g, '');

  if (!rawUrl || !/^[a-zA-Z0-9_-]+$/.test(rawUrl)) {
    return res.status(400).json({ error: 'Invalid storyUrl' });
  }

  const storyUrl = rawUrl;
  const title = (body.title || '').toString().trim();
  const author = (body.author || 'Anonymous').toString().trim();
  const rawDate = (body.date || '').toString().trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : new Date().toISOString().slice(0, 10);
  const rawTags = Array.isArray(body.tags) ? body.tags : (body.tags ? String(body.tags).split(',').map(s => s.trim()) : []);
  const tags = rawTags.map(t => String(t).replace(/[\r\n:#\[\]{}&*!|>'"%@`]/g, '').trim()).filter(t => t.length > 0);
  const description = (body.description || '').toString().trim();
  let artImage = (body.artImage || '').toString().trim();
  const storyId = (body.storyId || '').toString().trim();
  const chapter = body.chapter ? parseInt(body.chapter) : null;
  const chapterTitle = (body.chapterTitle || '').toString().trim();
  const content = (body.content || '').toString();

  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }

  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  const filePath = `_stories/${storyUrl}.md`;

  try {
    const currentFile = await getGitHubFile(ghToken, filePath);
    if (!currentFile) {
      return res.status(404).json({ error: 'Story file not found' });
    }

    // Inherit artwork from sibling chapters if none provided
    if (!artImage && storyId) {
      artImage = await inheritSeriesArtwork(ghToken, storyId, filePath);
    }

    // Build front matter (mirrors publish-edit.yml logic)
    let frontMatter = `---\nlayout: story\ntitle: "${escapeYamlString(title)}"\nauthor: "${escapeYamlString(author)}"\ndate: ${date} 12:00:00 -0500\n`;
    if (description) frontMatter += `description: "${escapeYamlString(description)}"\n`;
    if (artImage) frontMatter += `art_image: "${escapeYamlString(artImage)}"\n`;
    if (storyId) frontMatter += `story_id: "${storyId}"\n`;
    if (chapter) frontMatter += `chapter: ${chapter}\n`;
    if (chapterTitle) frontMatter += `chapter_title: "${escapeYamlString(chapterTitle)}"\n`;
    if (tags.length > 0) {
      frontMatter += 'tags:\n';
      tags.forEach(tag => { frontMatter += `  - "${tag}"\n`; });
    }
    frontMatter += '---\n';

    const fileContent = `${frontMatter}\n${content.trim()}\n`;

    const ok = await putGitHubFile(
      ghToken,
      filePath,
      fileContent,
      currentFile.sha,
      `Edit story: ${title.replace(/[`$\\"\n\r]/g, '')}`
    );

    if (!ok) {
      return res.status(502).json({ error: 'Failed to update story file on GitHub' });
    }

    // Propagate artwork to sibling chapters
    if (storyId && artImage) {
      await propagateSeriesArtwork(ghToken, storyId, filePath, artImage);
    }

    return res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error('Error updating story', err);
    return res.status(502).json({ error: 'Failed to update story' });
  }
}

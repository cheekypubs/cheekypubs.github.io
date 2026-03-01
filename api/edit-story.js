// Vercel Serverless Function: api/edit-story.js
// Accepts POST { storyUrl, title, author, date, tags, description, artImage, artAlt, artCaption, storyId, chapter, chapterTitle, content }
// and triggers a repository_dispatch event to update the story via GitHub Actions

import { setCorsHeaders, rejectUnauthenticated } from './lib/auth.js';

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rejectUnauthenticated(req, res)) return;

  const body = req.body || {};
  const storyUrl = (body.storyUrl || '').toString().trim();
  const title = (body.title || '').toString().trim();
  const author = (body.author || 'Anonymous').toString().trim();
  const date = (body.date || '').toString().trim();
  const tags = Array.isArray(body.tags) ? body.tags : (body.tags ? String(body.tags).split(',').map(s => s.trim()) : []);
  const description = (body.description || '').toString().trim();
  const artImage = (body.artImage || '').toString().trim();
  const artAlt = (body.artAlt || '').toString().trim();
  const artCaption = (body.artCaption || '').toString().trim();
  const storyId = (body.storyId || '').toString().trim();
  const chapter = body.chapter ? parseInt(body.chapter) : null;
  const chapterTitle = (body.chapterTitle || '').toString().trim();
  const content = (body.content || '').toString();

  if (!storyUrl || !title || !content) {
    return res.status(400).json({ error: 'storyUrl, title and content are required' });
  }

  const owner = 'cheekypubs';
  const repo = 'cheekypubs.github.io';
  const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`;

  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  const dispatchPayload = {
    event_type: 'story-edit',
    client_payload: {
      storyUrl,
      title,
      author,
      date,
      tags,
      description,
      content,
      artwork: { image: artImage, alt: artAlt, caption: artCaption },
      series: { id: storyId, chapter: chapter, title: chapterTitle }
    }
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

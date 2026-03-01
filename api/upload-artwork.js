// Vercel Serverless Function: api/upload-artwork.js
// Accepts POST { fileName, fileDataBase64 } and writes to assets/images/story-art/

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
  const rawName = (body.fileName || '').toString().trim().toLowerCase();
  const fileDataBase64 = (body.fileDataBase64 || '').toString().trim();

  if (!rawName || !fileDataBase64) {
    return res.status(400).json({ error: 'fileName and fileDataBase64 are required' });
  }

  const safeName = rawName
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!safeName || !/\.(svg|png|jpe?g|webp|gif)$/.test(safeName)) {
    return res.status(400).json({ error: 'Invalid file name or extension' });
  }

  if (fileDataBase64.length > 8 * 1024 * 1024) {
    return res.status(413).json({ error: 'File is too large' });
  }

  const owner = 'cheekypubs';
  const repo = 'cheekypubs.github.io';
  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured' });

  const repoPath = `assets/images/story-art/${safeName}`;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(repoPath)}`;

  const payload = {
    message: `Upload artwork: ${safeName}`,
    content: fileDataBase64,
    branch: 'main'
  };

  try {
    const ghResp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!ghResp.ok) {
      const text = await ghResp.text();
      return res.status(ghResp.status).json({ error: 'GitHub upload failed', detail: text });
    }

    return res.status(200).json({
      path: `/assets/images/story-art/${safeName}`,
      repoPath: repoPath
    });
  } catch (err) {
    console.error('Error uploading artwork', err);
    return res.status(502).json({ error: 'Failed to upload artwork' });
  }
}

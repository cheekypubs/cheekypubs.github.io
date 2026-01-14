// Vercel Serverless Function: api/submit-story.js
// Accepts POST { title, author, content, tags } and triggers a repository_dispatch

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const title = (body.title || '').toString().trim();
  const author = (body.author || 'Anonymous').toString().trim();
  const content = (body.content || '').toString();
  const tags = Array.isArray(body.tags) ? body.tags : (body.tags ? String(body.tags).split(',').map(s=>s.trim()) : []);

  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }

  const owner = 'cheekypubs';
  const repo = 'cheekypubs.github.io';
  const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`;

  const token = process.env.GITHUB_PAT;
  if (!token) return res.status(500).json({ error: 'Server not configured' });

  const payload = {
    event_type: 'story-submission',
    client_payload: { title, author, content, tags }
  };

  try {
    const ghResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
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

// Deployment notes:
// - In Vercel project settings, set Environment Variable `GITHUB_PAT` to a Personal Access Token
//   from the `cheekypubs` account with permission to trigger repository dispatches.
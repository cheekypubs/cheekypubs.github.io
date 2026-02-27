Vercel deployment notes
======================

This project uses Vercel Serverless Functions to accept story submissions and edits from the website and trigger GitHub Actions that write or update story files in `_stories/`.

Quick steps to deploy on Vercel
1. Create a Vercel account (https://vercel.com) and install the Vercel CLI if you want local testing: `npm i -g vercel`.
2. Import this repository into Vercel (New Project → Import Git Repository → select `cheekypubs/cheekypubs.github.io`).
3. In Project Settings → Environment Variables, add:
   - `GITHUB_PAT` = a Personal Access Token for the `cheekypubs` GitHub account.
     - Give minimal permissions: if using a classic token, `repo` scope is sufficient. Prefer a fine-grained token scoped to the single repository and allowed to trigger repository dispatches.
   - `ADMIN_PASSWORD_HASH` = the SHA-256 hex digest of the admin password.
   - `SESSION_SECRET` = a random secret string used to sign session tokens.
4. Deploy the project. Vercel will expose the serverless functions at:
   - `https://<project>.vercel.app/api/login`
   - `https://<project>.vercel.app/api/submit-story`
   - `https://<project>.vercel.app/api/get-story`
   - `https://<project>.vercel.app/api/edit-story`

Local testing
- Run `vercel dev` in the project root. Export environment variables in your shell for local testing:

```bash
export GITHUB_PAT=your_token_here
export ADMIN_PASSWORD_HASH=your_sha256_hash_here
export SESSION_SECRET=your_secret_here
vercel dev
```

Security notes
- Revoke any previously exposed tokens immediately and create a new PAT.
- Use rate limiting or CAPTCHA if you expect public abuse.

How it works
- `api/login.js` authenticates the admin password and sets an HttpOnly session cookie.
- `api/submit-story.js` sends a `repository_dispatch` event with `event_type: "story-submission"` and the story payload. The GitHub Action `.github/workflows/publish-submission.yml` listens for that event and writes a new markdown file into `_stories/`.
- `api/get-story.js` fetches the raw content of a story file from GitHub (requires auth).
- `api/edit-story.js` sends a `repository_dispatch` event with `event_type: "story-edit"` and the updated story payload. The GitHub Action `.github/workflows/edit-story.yml` listens for that event and overwrites the existing file in `_stories/`.

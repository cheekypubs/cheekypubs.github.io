Vercel deployment notes
======================

This project uses Vercel Serverless Functions to handle story submissions and edits from the website, and to authenticate admin users.

Quick steps to deploy on Vercel
1. Create a Vercel account (https://vercel.com) and install the Vercel CLI if you want local testing: `npm i -g vercel`.
2. Import this repository into Vercel (New Project → Import Git Repository → select `cheekypubs/cheekypubs.github.io`).
3. In Project Settings → Environment Variables, add:
   - `GITHUB_PAT` = a Personal Access Token for the `cheekypubs` GitHub account.
     - Give minimal permissions: if using a classic token, `repo` scope is sufficient. Prefer a fine-grained token scoped to the single repository and allowed to trigger repository dispatches.
   - `ADMIN_PASSWORD` = the password used to access the `/submit` and `/edit` admin pages.
     - Alternatively, set `ADMIN_PASSWORD_HASH` to the SHA-256 hex digest of the password if you prefer not to store it in plaintext.
   - `SESSION_SECRET` *(optional)* = a random string used to sign session tokens. If not set, `GITHUB_PAT` is used as the secret automatically.
4. Deploy the project. Vercel will expose the serverless functions at `https://<project>.vercel.app/api/...`.
5. Verify the forms post to the correct URLs (already configured in `assets/js/submit-story.js` and `assets/js/edit-story.js`).

Local testing
- Run `vercel dev` in the project root. Export env vars in your shell for local testing:

```bash
export GITHUB_PAT=your_token_here
export ADMIN_PASSWORD=your_admin_password
vercel dev
```

Security notes
- Revoke any previously exposed tokens immediately and create a new PAT.
- Use rate limiting or CAPTCHA if you expect public abuse.

How it works
- `api/login.js` verifies the admin password and sets a short-lived session cookie.
- `api/submit-story.js` sends a `repository_dispatch` event with `event_type: "story-submission"` and the story payload.
- `api/edit-story.js` sends a `repository_dispatch` event with `event_type: "story-edit"` and the updated story payload.
- The GitHub Actions in `.github/workflows/` listen for those events and write the markdown files into `_stories/`.

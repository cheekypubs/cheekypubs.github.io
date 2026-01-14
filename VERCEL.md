Vercel deployment notes
======================

This project uses a Vercel Serverless Function to accept story submissions from the website and trigger a GitHub Action that writes the submitted story into `_stories/`.

Quick steps to deploy on Vercel
1. Create a Vercel account (https://vercel.com) and install the Vercel CLI if you want local testing: `npm i -g vercel`.
2. Import this repository into Vercel (New Project → Import Git Repository → select `cheekypubs/cheekypubs.github.io`).
3. In Project Settings → Environment Variables, add:
   - `GITHUB_PAT` = a Personal Access Token for the `cheekypubs` GitHub account.
     - Give minimal permissions: if using a classic token, `repo` scope is sufficient. Prefer a fine-grained token scoped to the single repository and allowed to trigger repository dispatches.
4. Deploy the project. Vercel will expose the serverless function at `https://<project>.vercel.app/api/submit-story`.
5. Update the site or verify the form posts to `/api/submit-story` (this repo's `assets/js/submit-story.js` is already configured to POST there).

Local testing
- Run `vercel dev` in the project root. Export `GITHUB_PAT` in your shell for local testing:

```bash
export GITHUB_PAT=your_token_here
vercel dev
```

Security notes
- Revoke any previously exposed tokens immediately and create a new PAT.
- Use rate limiting or CAPTCHA if you expect public abuse.

How it works
- The function `api/submit-story.js` sends a `repository_dispatch` event with `event_type: "story-submission"` and the story payload.
- The GitHub Action `.github/workflows/publish-submission.yml` (already present) listens for that event and writes the markdown file into `_stories/`.

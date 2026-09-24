Vercel deployment notes
======================

This project uses Vercel Serverless Functions to handle story submissions and edits from the website, and to authenticate admin users.

Quick steps to deploy on Vercel
1. Create a Vercel account (https://vercel.com) and install the Vercel CLI if you want local testing: `npm i -g vercel`.
2. Import this repository into Vercel (New Project → Import Git Repository → select `cheekypubs/cheekypubs.github.io`).
3. In Project Settings → Environment Variables, add:
   - `GITHUB_PAT` = a Personal Access Token for the `cheekypubs` GitHub account.
     - Give minimal permissions: if using a classic token, `repo` scope is sufficient. Prefer a fine-grained token scoped to the single repository and allowed to trigger repository dispatches.
   - `ADMIN_PASSWORD` = the password used to access the `/admin` page.
     - Alternatively, set `ADMIN_PASSWORD_HASH` to the SHA-256 hex digest of the password if you prefer not to store it in plaintext.
   - `SESSION_SECRET` *(optional)* = a random string used to sign session tokens. If not set, `GITHUB_PAT` is used as the secret automatically.
   - `TURNSTILE_SECRET_KEY` *(optional but recommended)* = the secret key from a [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) widget, used to verify the public story submission form isn't a bot. If unset, `api/submit-pending.js` skips Turnstile verification and relies on the honeypot field alone.
     - After creating the Turnstile widget, also put its **site key** (public, safe to commit) into the `data-sitekey` attribute in `submit.html` in place of `YOUR_TURNSTILE_SITE_KEY`.
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
- `api/submit-story.js` sends a `repository_dispatch` event with `event_type: "story-submission"` and the story payload. This is what the "Publish Story" admin tab uses, whether filling the form from scratch or from a loaded pending submission.
- `api/edit-story.js` sends a `repository_dispatch` event with `event_type: "story-edit"` and the updated story payload.
- The GitHub Actions in `.github/workflows/` listen for those events and write the markdown files into `_stories/`.

Public submission queue
- Writers submit through the public form at `/submit/` (`assets/js/submit-form.js`), which posts to `api/submit-pending.js`.
- That function checks the honeypot field and (if configured) verifies the Turnstile token, then opens a GitHub Issue labeled `pending-submission` holding the submission's fields — nothing is published automatically.
- The admin "📥 Submissions" tab (`api/list-submissions.js`) lists those open issues. "Review & Publish" loads one into the Publish Story form for you to check and edit before publishing as normal; "Reject" closes it without publishing. Either action closes the issue via `api/close-submission.js`.

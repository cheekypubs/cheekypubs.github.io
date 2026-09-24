# Cheeky.Pub - Stories Site

A Jekyll-based stories publication site with user submissions.

## Features

- **Stories Collection**: Markdown-based stories with author and tag support
- **Story Submission**: Password-protected form for community contributions
- **Author Pages**: Browse stories by author
- **Tag System**: Filter stories by tags
- **Mobile Responsive**: Full mobile support with hamburger menu

## Site Structure

```
cheekypubs.github.io/
├── _config.yml           # Jekyll configuration
├── _layouts/             # Page layouts
│   ├── default.html      # Base layout
│   ├── stories.html      # Stories list page
│   ├── story.html        # Individual story page
│   ├── author.html       # Author filter page
│   └── tag.html          # Tag filter page
├── _includes/            # Reusable components
│   ├── header.html       # Site header with navigation
│   └── footer.html       # Site footer with social links
├── _stories/             # Story files (Markdown)
├── pages/
│   ├── authors/          # Author filter pages
│   └── tags/             # Tag filter pages
├── assets/
│   ├── css/style.css     # Site styles
│   ├── js/               # JavaScript files
│   └── images/           # Logo and social icons
├── netlify/              # Netlify serverless functions
└── .github/workflows/    # GitHub Actions for story processing
```

## Story Submission System

Submissions are two-stage: writers submit publicly, an admin reviews and publishes. See `VERCEL.md` for the full flow and required environment variables (`GITHUB_PAT`, `ADMIN_PASSWORD`, `TURNSTILE_SECRET_KEY`).

1. A writer submits a story through the public form at `/submit/` (no login required; a honeypot field and optional Cloudflare Turnstile check guard against spam).
2. This opens a `pending-submission`-labeled GitHub Issue — nothing is published yet.
3. The site owner reviews pending submissions in the "📥 Submissions" tab of `/admin/` (password-protected) and either publishes (loads it into the Publish Story form for a final check/edit) or rejects it.
4. Publishing triggers the same `repository_dispatch` → GitHub Action pipeline used by the admin's own "Publish Story" tab, which commits the story to `_stories/`.
5. Story appears on site after GitHub Pages rebuild.

Backend logic lives in `api/*.js` (deployed on Vercel, not GitHub Pages — see `VERCEL.md`).

## Local Development

```bash
# Install Jekyll
gem install bundler jekyll

# Install dependencies
bundle install

# Serve locally
bundle exec jekyll serve

# Visit http://localhost:4000
```

## Related Site

This stories site is associated with [Cheeky Parties](https://cheekyparties.github.io).

## License

© Cheeky Parties

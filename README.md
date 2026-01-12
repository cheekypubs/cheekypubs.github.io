# Cheeky Pubs - Stories Site

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

Stories are submitted via a password-protected form. The submission flow:

1. User enters password and submits story via form
2. Form sends data to Netlify serverless function
3. Function creates a GitHub Issue with story content (Base64 encoded)
4. GitHub Action processes the issue, decodes content, and commits the story
5. Story appears on site after GitHub Pages rebuild

### Setup Requirements

1. **Netlify**: Deploy the repo to Netlify and set `GITHUB_TOKEN` environment variable
2. **GitHub Token**: Personal access token with `repo` scope for creating issues

### Password

The submission password hash is stored in `assets/js/submit-story.js`. 
To change the password, generate a new SHA-256 hash in browser console:

```javascript
crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
  .then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('')))
```

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

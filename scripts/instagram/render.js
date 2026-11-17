#!/usr/bin/env node
/**
 * Render Instagram post images (1080x1350, 4:5) for a story.
 *
 *   node scripts/instagram/render.js promo <slug>
 *   node scripts/instagram/render.js quote <slug> "Quote text"
 *   node scripts/instagram/render.js all        (a promo for every story)
 *
 * <slug> is the _stories filename without .md (or any unique substring, e.g. "birchbright").
 * Output goes to instagram-out/ (gitignored). Requires Google Chrome; no npm deps.
 * For series, art falls back to the first chapter that has art_image.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parse(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\s*\n([\s\S]*?)\n---/);
  const y = m[1];
  const get = k => { const r = y.match(new RegExp(`^${k}:\\s*["']?(.*?)["']?\\s*$`, 'm')); return r ? r[1] : ''; };
  const tags = [...(y.match(/^tags:\s*\n((?:\s+-.*\n?)*)/m)?.[1] || '').matchAll(/-\s*["']?([^"'\n]+)["']?/g)].map(t => t[1].trim());
  return { title: get('title'), author: get('author'), description: get('description'), art: get('art_image'), storyId: get('story_id'), tags };
}

function findStory(slug) {
  const dir = path.join(ROOT, '_stories');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f.includes(slug)).sort();
  if (!files.length) throw new Error(`No story matching "${slug}"`);
  const exact = files.filter(f => f.replace(/\.md$/, '') === slug);
  const pick = exact.length ? exact : files;
  if (pick.length > 1 && !pick.every(f => parse(path.join(dir, f)).storyId && parse(path.join(dir, f)).storyId === parse(path.join(dir, pick[0])).storyId))
    throw new Error(`"${slug}" is ambiguous: ${pick.join(', ')}`);
  const story = parse(path.join(dir, pick[0]));
  if (!story.art && story.storyId) {
    for (const f of fs.readdirSync(dir).sort()) {
      const s = parse(path.join(dir, f));
      if (s.storyId === story.storyId && s.art) { story.art = s.art; break; }
    }
  }
  return { story, file: pick[0].replace(/\.md$/, '') };
}

function render(template, vars, out) {
  let html = fs.readFileSync(path.join(__dirname, `${template}.html`), 'utf8');
  for (const [k, v] of Object.entries(vars)) html = html.split(`{{${k}}}`).join(v);
  const tmp = path.join(__dirname, `.tmp-${template}.html`);
  fs.writeFileSync(tmp, html);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  try {
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      '--force-device-scale-factor=1', '--window-size=1080,1350', '--virtual-time-budget=8000',
      `--screenshot=${out}`, `file://${tmp}`], { stdio: 'ignore' });
  } finally { fs.unlinkSync(tmp); }
  console.log(out);
}

function makePromo(slug) {
  const { story, file } = findStory(slug);
  render('promo', baseVars(story, { DESCRIPTION: esc(story.description), TAGS: story.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('') }),
    path.join(ROOT, 'instagram-out', `${file}-promo.png`));
}

function baseVars(story, extra) {
  const artPath = story.art ? path.join(ROOT, story.art) : path.join(ROOT, 'assets/images/default-story-thumb.svg');
  return { ART: 'file://' + artPath, LOGO: 'file://' + path.join(ROOT, 'assets/images/logo/Cheekypub.png'),
    TITLE: esc(story.title), AUTHOR: esc(story.author), ...extra };
}

const [kind, slug, quote] = process.argv.slice(2);
if (kind === 'all') {
  // One promo per story (series use chapter 1), skipping later chapters.
  const dir = path.join(ROOT, '_stories');
  const seen = new Set();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
    const id = parse(path.join(dir, f)).storyId || f;
    if (seen.has(id)) continue;
    seen.add(id);
    makePromo(f.replace(/\.md$/, ''));
  }
} else if (!['promo', 'quote'].includes(kind) || !slug || (kind === 'quote' && !quote)) {
  console.error('Usage:\n  render.js promo <slug>\n  render.js quote <slug> "Quote text"\n  render.js all   (promo for every story)'); process.exit(1);
} else if (kind === 'promo') {
  makePromo(slug);
} else {
  const { story, file } = findStory(slug);
  const q = quote.replace(/^[“"]|[”"]$/g, '');
  const QSIZE = q.length > 260 ? 40 : q.length > 160 ? 50 : q.length > 90 ? 58 : 68;
  render('quote', baseVars(story, { QUOTE: esc(q), QSIZE }), path.join(ROOT, 'instagram-out', `${file}-quote-${String(Date.now()).slice(-6)}.png`));
}

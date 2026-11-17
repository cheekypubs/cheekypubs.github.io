#!/usr/bin/env node
/**
 * Render Instagram post images (1080x1350, 4:5) for a story.
 *
 *   node scripts/instagram/render.js promo <slug>
 *   node scripts/instagram/render.js quote <slug> "Quote text"
 *   node scripts/instagram/render.js new <slug>     ("Just uploaded" promo; Story size, or 4:5 with --feed)
 *   node scripts/instagram/render.js all        (a promo for every story)
 *   node scripts/instagram/render.js batch <slug>   (every quote in scripts/instagram/quotes/<slug>.json)
 *
 * Quote cards are Instagram Stories (1080x1920, UI-safe margins) by default; add --feed for 4:5 (1080x1350).
 * Quote themes: "art" (sharp story art fading into a wine panel) and "cream" (brand cream, type only).
 * Add --only=3,7 to re-render just those numbered quotes from a batch.
 * Batch quotes are checked against the story text and rendered from the story's exact characters.
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

function render(template, vars, out, height = 1350) {
  let html = fs.readFileSync(path.join(__dirname, `${template}.html`), 'utf8');
  for (const [k, v] of Object.entries(vars)) html = html.split(`{{${k}}}`).join(v);
  const tmp = path.join(__dirname, `.tmp-${template}.html`);
  fs.writeFileSync(tmp, html);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  try {
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      '--force-device-scale-factor=1', `--window-size=1080,${height}`, '--virtual-time-budget=8000',
      `--screenshot=${out}`, `file://${tmp}`], { stdio: 'ignore' });
  } finally { fs.unlinkSync(tmp); }
  console.log(out);
}

const FEED = process.argv.includes('--feed');

function makePromo(slug, { badge = '' } = {}) {
  const { story, file } = findStory(slug);
  const feed = !badge || FEED;
  const L = feed
    ? { H: 1350, ART_H: 800, FOOTBOT: 34, BADGE_TOP: 44 }
    : { H: 1920, ART_H: 1040, FOOTBOT: 300, BADGE_TOP: 290 };   // Story: keep clear of Instagram's top/bottom UI
  render('promo', baseVars(story, {
    DESCRIPTION: esc(story.description),
    TAGS: story.tags.map(t => `<span class="tag">${esc(t)}</span>`).join(''),
    BADGE: esc(badge), BADGE_DISPLAY: badge ? 'block' : 'none', ...L,
  }), path.join(ROOT, 'instagram-out', `${file}-${badge ? 'just-uploaded' : 'promo'}${badge ? (feed ? '-feed' : '-story') : ''}.png`), L.H);
}

function baseVars(story, extra) {
  const artPath = story.art ? path.join(ROOT, story.art) : path.join(ROOT, 'assets/images/default-story-thumb.svg');
  return { ART: 'file://' + artPath, LOGO: 'file://' + path.join(ROOT, 'assets/images/logo/Cheekypub.png'),
    TITLE: esc(story.title), AUTHOR: esc(story.author), ...extra };
}

// ---- quote cards ----
const norm = s => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

function sizeFor(text, avail, max) {
  for (let size = max; size >= 34; size -= 2) {
    const perLine = Math.floor(860 / (size * 0.47)) * 0.92;
    if (Math.ceil(text.length / perLine) * size * 1.28 <= avail) return size;
  }
  return 34;
}

function quoteCard(story, file, text, { theme = 'art', focus = '50% 50% 1', tag = '' } = {}) {
  const [px, py, zoom] = focus.split(/\s+/).map(v => parseFloat(v));
  const L = FEED
    ? { H: 1350, ART_H: 760, CTOP: theme === 'art' ? 640 : 120, PADBOT: 200, FOOTBOT: 70 }
    : { H: 1920, ART_H: 1180, CTOP: theme === 'art' ? 1010 : 250, PADBOT: theme === 'art' ? 430 : 480, FOOTBOT: FEED ? 70 : 290 };
  const avail = (L.H - L.CTOP - L.PADBOT) - 90 - 40 - 29 - 24 - 40;   // minus mark, rule, source, margins
  const QSIZE = sizeFor(text, avail, theme === 'art' ? 56 : 72);
  const out = path.join(ROOT, 'instagram-out', `${file}-quote${tag}-${FEED ? 'feed' : 'story'}.png`);
  render('quote', baseVars(story, { QUOTE: esc(text), QSIZE, THEME: theme, POSX: px, POSY: py, ZOOM: zoom || 1, ...L }), out, L.H);
}

function batch(slug) {
  const { story, file } = findStory(slug);
  const cfgPath = path.join(__dirname, 'quotes', `${slug}.json`);
  if (!fs.existsSync(cfgPath)) throw new Error(`Missing ${cfgPath}`);
  // For a series, quotes may come from any chapter: search every chapter file of the story.
  const dir = path.join(ROOT, '_stories');
  const files = story.storyId
    ? fs.readdirSync(dir).filter(f => f.endsWith('.md') && parse(path.join(dir, f)).storyId === story.storyId).sort()
    : [`${file}.md`];
  const bodies = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8'));
  const items = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean).map(Number);
  items.forEach((it, n) => {
    if (only.length && !only.includes(n + 1)) return;
    const nq = norm(it.text);
    let exact = null;
    for (const body of bodies) {
      const i = norm(body).indexOf(nq);
      if (i >= 0) { exact = body.slice(i, i + it.text.length); break; }
    }
    if (!exact) throw new Error(`Quote ${n + 1} is not in the story text: "${it.text.slice(0, 50)}..."`);
    quoteCard(story, file, exact, { theme: it.theme, focus: it.focus, tag: `-${String(n + 1).padStart(2, '0')}` });
  });
}

const [kind, slug, quote] = process.argv.slice(2).filter(a => !a.startsWith('--'));
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
} else if (kind === 'new' && slug) {
  makePromo(slug, { badge: 'Just uploaded' });
} else if (kind === 'batch' && slug) {
  batch(slug);
} else if (!['promo', 'quote'].includes(kind) || !slug || (kind === 'quote' && !quote)) {
  console.error('Usage:\n  render.js promo <slug>\n  render.js new <slug> [--feed]\n  render.js quote <slug> "Quote text" [--feed]\n  render.js batch <slug> [--feed]\n  render.js all   (promo for every story)'); process.exit(1);
} else if (kind === 'promo') {
  makePromo(slug);
} else {
  const { story, file } = findStory(slug);
  quoteCard(story, file, quote.replace(/^[“"]|[”"]$/g, ''), { tag: `-${String(Date.now()).slice(-6)}` });
}

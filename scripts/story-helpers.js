/**
 * Shared helper functions for GitHub Actions workflows that manage story files.
 * Used by publish-submission.yml and publish-edit.yml.
 *
 * Usage in github-script:
 *   const helpers = require('./scripts/story-helpers.js');
 */

const fs = require('fs');
const path = require('path');

/**
 * Split a file's content into front matter YAML and body.
 * Returns { yaml, body } or null if no front matter found.
 */
function splitFrontMatter(fileContent) {
  const match = fileContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2] || '' };
}

/**
 * Extract a simple scalar value from YAML front matter.
 */
function getYamlValue(yaml, key) {
  const regex = new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm');
  const match = yaml.match(regex);
  return match ? String(match[1]).trim() : '';
}

/**
 * Insert or update a key-value pair in YAML front matter.
 */
function upsertYamlValue(yaml, key, value) {
  const safeValue = String(value || '').replace(/"/g, '\\"');
  const line = `${key}: "${safeValue}"`;
  const regex = new RegExp(`^${key}:.*$`, 'm');
  if (regex.test(yaml)) return yaml.replace(regex, line);
  return `${yaml}\n${line}`;
}

/**
 * Look up artwork from the earliest chapter of a series that has art set.
 * Returns { image, alt, caption } or null.
 */
function getSeriesArtwork(seriesId, currentFilePath) {
  if (!seriesId) return null;
  const storiesDir = '_stories';
  if (!fs.existsSync(storiesDir)) return null;

  const candidates = [];
  for (const name of fs.readdirSync(storiesDir)) {
    if (!name.endsWith('.md')) continue;
    const candidatePath = path.join(storiesDir, name);
    if (candidatePath === currentFilePath) continue;

    const raw = fs.readFileSync(candidatePath, 'utf8');
    const parsed = splitFrontMatter(raw);
    if (!parsed) continue;
    if (getYamlValue(parsed.yaml, 'story_id') !== seriesId) continue;

    const image = getYamlValue(parsed.yaml, 'art_image');
    if (!image) continue;

    const chapterValue = parseInt(getYamlValue(parsed.yaml, 'chapter'), 10);
    candidates.push({
      chapter: Number.isFinite(chapterValue) ? chapterValue : Number.MAX_SAFE_INTEGER,
      image,
      alt: getYamlValue(parsed.yaml, 'art_alt'),
      caption: getYamlValue(parsed.yaml, 'art_caption')
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.chapter - b.chapter);
  return candidates[0];
}

/**
 * Inherit missing artwork fields from an existing series chapter.
 * Mutates artFields in place: { image, alt, caption }.
 */
function inheritSeriesArtwork(storyId, filepath, artFields) {
  if (!storyId) return;
  if (artFields.image && artFields.alt && artFields.caption) return;

  const inherited = getSeriesArtwork(storyId, filepath);
  if (!inherited) return;

  if (!artFields.image) artFields.image = inherited.image || '';
  if (!artFields.alt) artFields.alt = inherited.alt || '';
  if (!artFields.caption) artFields.caption = inherited.caption || '';
}

/**
 * Propagate artwork from one story to all sibling chapters in the same series.
 */
function propagateSeriesArtwork(storyId, filepath, artImage, artAlt, artCaption) {
  if (!storyId || !artImage) return;

  const storiesDir = '_stories';
  const chapterFiles = fs.readdirSync(storiesDir).filter(name => name.endsWith('.md'));

  chapterFiles.forEach(name => {
    const chapterPath = path.join(storiesDir, name);
    if (chapterPath === filepath) return;

    const raw = fs.readFileSync(chapterPath, 'utf8');
    const parsed = splitFrontMatter(raw);
    if (!parsed) return;
    if (getYamlValue(parsed.yaml, 'story_id') !== storyId) return;

    let yaml = parsed.yaml;
    yaml = upsertYamlValue(yaml, 'art_image', artImage);
    if (artAlt) yaml = upsertYamlValue(yaml, 'art_alt', artAlt);
    if (artCaption) yaml = upsertYamlValue(yaml, 'art_caption', artCaption);

    const rebuilt = `---\n${yaml}\n---\n\n${parsed.body.replace(/^\n+/, '')}`;
    fs.writeFileSync(chapterPath, `${rebuilt}\n`);
  });
}

module.exports = {
  splitFrontMatter,
  getYamlValue,
  upsertYamlValue,
  getSeriesArtwork,
  inheritSeriesArtwork,
  propagateSeriesArtwork
};

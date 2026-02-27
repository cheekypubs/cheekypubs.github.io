/**
 * Admin Story Editing JavaScript
 * Handles password authentication, story selection and editing via Vercel API
 */

// Vercel API endpoints (absolute URLs for cross-origin from GitHub Pages)
const API_BASE = 'https://cheekypubs.vercel.app';
const LOGIN_URL = `${API_BASE}/api/login`;
const GET_STORY_URL = `${API_BASE}/api/get-story`;
const EDIT_STORY_URL = `${API_BASE}/api/edit-story`;

document.addEventListener('DOMContentLoaded', function () {
  const passwordGate = document.getElementById('passwordGate');
  const editingForm = document.getElementById('editingForm');
  const passwordInput = document.getElementById('passwordInput');
  const passwordSubmit = document.getElementById('passwordSubmit');
  const passwordError = document.getElementById('passwordError');
  const storyEditForm = document.getElementById('storyEditForm');
  const storySelect = document.getElementById('storySelect');

  let originalTimeSuffix = '12:00:00 -0500'; // preserve original time/timezone when editing

  // Check if already authenticated (session storage)
  if (sessionStorage.getItem('storyEditAuth') === 'true') {
    showEditingForm();
  }

  // Password submission
  if (passwordSubmit) {
    passwordSubmit.addEventListener('click', checkPassword);
    passwordInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') checkPassword();
    });
  }

  async function checkPassword() {
    const password = passwordInput.value;
    if (!password) {
      showPasswordError('Please enter a password.');
      return;
    }

    try {
      const resp = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        showPasswordError(err.error || 'Invalid password');
        return;
      }

      sessionStorage.setItem('storyEditAuth', 'true');
      showEditingForm();
    } catch (e) {
      showPasswordError('Authentication failed');
    }
  }

  function showPasswordError(message) {
    passwordError.textContent = message;
    passwordError.style.display = 'block';
    passwordInput.classList.add('error');
  }

  function showEditingForm() {
    if (passwordGate) passwordGate.style.display = 'none';
    if (editingForm) editingForm.style.display = 'block';
    loadStories();
  }

  // Load all stories into the dropdown
  async function loadStories() {
    try {
      const resp = await fetch('/stories.json');
      if (!resp.ok) throw new Error('Could not load stories list');
      const stories = await resp.json();

      storySelect.innerHTML = '<option value="">Select a story to edit...</option>';
      stories.forEach(function (story) {
        const option = document.createElement('option');
        option.value = story.path;
        const label = story.chapter
          ? `${story.title} — Ch.${story.chapter}${story.chapter_title ? ': ' + story.chapter_title : ''} (${story.date})`
          : `${story.title} (${story.date})`;
        option.textContent = label;
        option.dataset.story = JSON.stringify(story);
        storySelect.appendChild(option);
      });
    } catch (e) {
      storySelect.innerHTML = '<option value="">Could not load stories</option>';
    }
  }

  // When a story is selected, fetch and populate the form
  storySelect.addEventListener('change', async function () {
    const path = this.value;
    if (!path) {
      document.getElementById('storyPreview').style.display = 'none';
      return;
    }

    const storyMeta = JSON.parse(this.options[this.selectedIndex].dataset.story);

    document.getElementById('storyPreview').style.display = 'block';
    document.getElementById('currentFilePath').value = path;

    try {
      const resp = await fetch(`${GET_STORY_URL}?path=${encodeURIComponent(path)}`, {
        credentials: 'include'
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${resp.status}`);
      }
      const data = await resp.json();
      populateForm(data.content, storyMeta);
    } catch (e) {
      alert('Could not load story content: ' + e.message);
    }
  });

  // Populate form fields from raw file content and story metadata
  function populateForm(rawContent, storyMeta) {
    const { frontMatter, body } = parseFrontMatter(rawContent);

    document.getElementById('editTitle').value = frontMatter.title || storyMeta.title || '';
    document.getElementById('editAuthor').value = frontMatter.author || storyMeta.author || '';

    // Extract YYYY-MM-DD and preserve the original time/timezone for saving
    const dateStr = String(frontMatter.date || storyMeta.date || '');
    document.getElementById('editDate').value = dateStr.substring(0, 10);
    const timePart = dateStr.length > 10 ? dateStr.substring(11).trim() : '';
    originalTimeSuffix = timePart || '12:00:00 -0500';

    const tags = Array.isArray(frontMatter.tags) ? frontMatter.tags : [];
    document.getElementById('editTags').value = tags.join(', ');

    document.getElementById('editDescription').value = frontMatter.description || storyMeta.description || '';
    document.getElementById('editStoryId').value = frontMatter.story_id || storyMeta.story_id || '';
    document.getElementById('editChapter').value = frontMatter.chapter || storyMeta.chapter || '';
    document.getElementById('editChapterTitle').value = frontMatter.chapter_title || storyMeta.chapter_title || '';
    document.getElementById('editContent').value = body;
  }

  // Simple YAML front matter parser
  function parseFrontMatter(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { frontMatter: {}, body: raw };

    const yamlLines = match[1].split('\n');
    const body = match[2].trim();
    const frontMatter = {};
    let currentArrayKey = null;

    for (const line of yamlLines) {
      if (!line.trim()) continue;

      const arrayStart = line.match(/^([\w_]+):\s*$/);
      const arrayItem = line.match(/^\s+-\s+(.+)/);
      const kvMatch = line.match(/^([\w_]+):\s+(.+)/);

      if (arrayStart) {
        currentArrayKey = arrayStart[1];
        frontMatter[currentArrayKey] = [];
      } else if (arrayItem && currentArrayKey) {
        frontMatter[currentArrayKey].push(arrayItem[1].trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"'));
      } else if (kvMatch) {
        currentArrayKey = null;
        const key = kvMatch[1];
        const val = kvMatch[2].trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
        frontMatter[key] = val;
      }
    }

    return { frontMatter, body };
  }

  function escapeYaml(str) {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  // Build full markdown content with front matter from form values
  function buildContent(title, author, date, tags, description, storyId, chapter, chapterTitle, body) {
    let yaml = `---\nlayout: story\ntitle: "${escapeYaml(title)}"\nauthor: "${escapeYaml(author)}"\ndate: ${date} ${originalTimeSuffix}\n`;

    if (description) yaml += `description: "${escapeYaml(description)}"\n`;
    if (storyId) yaml += `story_id: "${storyId}"\n`;
    if (chapter) yaml += `chapter: ${chapter}\n`;
    if (chapterTitle) yaml += `chapter_title: "${escapeYaml(chapterTitle)}"\n`;

    if (tags.length > 0) {
      yaml += 'tags:\n';
      tags.forEach(function (tag) { yaml += `  - ${tag}\n`; });
    }

    yaml += '---\n\n';
    return yaml + body;
  }

  // Story edit form submission
  if (storyEditForm) {
    storyEditForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const filepath = document.getElementById('currentFilePath').value;
      if (!filepath) {
        alert('Please select a story to edit.');
        return;
      }

      const updateBtn = document.getElementById('updateBtn');
      const btnText = updateBtn.querySelector('.btn-text');
      const btnLoading = updateBtn.querySelector('.btn-loading');

      btnText.style.display = 'none';
      btnLoading.style.display = 'inline';
      updateBtn.disabled = true;

      const title = document.getElementById('editTitle').value.trim();
      const author = document.getElementById('editAuthor').value.trim();
      const date = document.getElementById('editDate').value;
      const tagsInput = document.getElementById('editTags').value.trim();
      const description = document.getElementById('editDescription').value.trim();
      const storyId = document.getElementById('editStoryId').value.trim();
      const chapter = document.getElementById('editChapter').value.trim();
      const chapterTitle = document.getElementById('editChapterTitle').value.trim();
      const body = document.getElementById('editContent').value;

      const tags = tagsInput
        ? tagsInput.split(',').map(function (t) { return t.trim(); }).filter(function (t) { return t.length > 0; })
        : [];

      const content = buildContent(title, author, date, tags, description, storyId, chapter, chapterTitle, body);

      try {
        const resp = await fetch(EDIT_STORY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ filepath, title, content, tags })
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `Server error: ${resp.status}`);
        }

        storyEditForm.style.display = 'none';
        document.getElementById('editSuccess').style.display = 'block';

      } catch (error) {
        console.error('Edit error:', error);
        storyEditForm.style.display = 'none';
        document.getElementById('editError').style.display = 'block';
        document.getElementById('errorDetails').textContent = error.message;
      } finally {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        updateBtn.disabled = false;
      }
    });
  }
});

// Global clearForm function (called from onclick in edit.html)
function clearForm() {
  const storySelect = document.getElementById('storySelect');
  if (storySelect) storySelect.value = '';
  document.getElementById('storyPreview').style.display = 'none';
  document.getElementById('currentFilePath').value = '';
  document.getElementById('editTitle').value = '';
  document.getElementById('editAuthor').value = '';
  document.getElementById('editDate').value = '';
  document.getElementById('editTags').value = '';
  document.getElementById('editDescription').value = '';
  document.getElementById('editStoryId').value = '';
  document.getElementById('editChapter').value = '';
  document.getElementById('editChapterTitle').value = '';
  document.getElementById('editContent').value = '';
}

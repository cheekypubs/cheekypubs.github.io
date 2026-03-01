/**
 * Admin Interface JavaScript
 * Unified admin page with tabbed interface for publishing and editing stories.
 * Handles single password authentication, tab switching, story submission, and story editing.
 */

// Vercel API endpoints (absolute URLs for cross-origin from GitHub Pages)
const API_BASE = 'https://cheekypubs.vercel.app';
const LOGIN_URL = `${API_BASE}/api/login`;
const SUBMIT_URL = `${API_BASE}/api/submit-story`;
const EDIT_URL = `${API_BASE}/api/edit-story`;
const DELETE_URL = `${API_BASE}/api/delete-story`;

// Session storage key for the unified admin token
const TOKEN_KEY = 'adminToken';
const AUTH_KEY = 'adminAuth';

// Store multi-chapter stories for the publish dropdown
let multiChapterStories = [];

// ─── Tab Switching ────────────────────────────────────────────────────────────

function switchTab(tab) {
  const publishBtn = document.getElementById('publishTabBtn');
  const editBtn = document.getElementById('editTabBtn');
  const publishContent = document.getElementById('publishContent');
  const editContent = document.getElementById('editContent');

  if (tab === 'publish') {
    publishBtn.classList.add('active');
    publishBtn.setAttribute('aria-selected', 'true');
    editBtn.classList.remove('active');
    editBtn.setAttribute('aria-selected', 'false');
    publishContent.classList.add('active');
    editContent.classList.remove('active');
  } else {
    editBtn.classList.add('active');
    editBtn.setAttribute('aria-selected', 'true');
    publishBtn.classList.remove('active');
    publishBtn.setAttribute('aria-selected', 'false');
    editContent.classList.add('active');
    publishContent.classList.remove('active');
  }
}

// ─── Clear edit form ──────────────────────────────────────────────────────────

function clearEditForm() {
  const storySelect = document.getElementById('storySelect');
  if (storySelect) storySelect.value = '';

  const storyPreview = document.getElementById('storyPreview');
  if (storyPreview) storyPreview.style.display = 'none';

  ['editTitle', 'editAuthor', 'editDate', 'editTags', 'editDescription',
   'editStoryId', 'editChapter', 'editChapterTitle', 'editStoryContent'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  const passwordGate = document.getElementById('passwordGate');
  const adminInterface = document.getElementById('adminInterface');
  const passwordInput = document.getElementById('passwordInput');
  const passwordSubmit = document.getElementById('passwordSubmit');
  const passwordError = document.getElementById('passwordError');

  // ── Authentication ──────────────────────────────────────────────────────────

  // Check if already authenticated this session
  if (sessionStorage.getItem(AUTH_KEY) === 'true' && sessionStorage.getItem(TOKEN_KEY)) {
    showAdminInterface();
  } else {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  if (passwordSubmit) {
    passwordSubmit.addEventListener('click', checkPassword);
    passwordInput.addEventListener('keypress', function(e) {
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

      const data = await resp.json().catch(() => ({}));
      if (data.token) {
        sessionStorage.setItem(TOKEN_KEY, data.token);
      }
      sessionStorage.setItem(AUTH_KEY, 'true');
      showAdminInterface();
    } catch (e) {
      showPasswordError('Authentication failed');
    }
  }

  function showPasswordError(message) {
    passwordError.textContent = message;
    passwordError.style.display = 'block';
    passwordInput.classList.add('error');
  }

  function showAdminInterface() {
    if (passwordGate) passwordGate.style.display = 'none';
    if (adminInterface) adminInterface.style.display = 'block';
    initPublishForm();
    initEditForm();
  }

  // ── Publish Form ────────────────────────────────────────────────────────────

  function initPublishForm() {
    const chapterTypeRadios = document.querySelectorAll('input[name="chapterType"]');
    const existingStoryGroup = document.getElementById('existingStoryGroup');
    const chapterNumberGroup = document.getElementById('chapterNumberGroup');
    const chapterTitleGroup = document.getElementById('chapterTitleGroup');

    if (chapterTypeRadios) {
      chapterTypeRadios.forEach(function(radio) {
        radio.addEventListener('change', handleChapterTypeChange);
      });
    }

    function handleChapterTypeChange(e) {
      const type = e.target.value;

      existingStoryGroup.style.display = 'none';
      chapterNumberGroup.style.display = 'none';
      chapterTitleGroup.style.display = 'none';

      if (type === 'new-series') {
        chapterNumberGroup.style.display = 'block';
        chapterTitleGroup.style.display = 'block';
        document.getElementById('chapterNumber').value = '1';
      } else if (type === 'add-chapter') {
        existingStoryGroup.style.display = 'block';
        chapterNumberGroup.style.display = 'block';
        chapterTitleGroup.style.display = 'block';
        loadExistingStories();
      }
    }

    async function loadExistingStories() {
      try {
        if (window.existingStories && window.existingStories.length > 0) {
          populatePublishStorySelect(window.existingStories);
        } else {
          const response = await fetch('/stories.json');
          if (response.ok) {
            const stories = await response.json();
            multiChapterStories = stories.filter(function(story) { return story.story_id; });
            populatePublishStorySelect(multiChapterStories);
          } else {
            document.getElementById('existingStory').innerHTML = '<option value="">No existing stories found</option>';
          }
        }
      } catch (e) {
        document.getElementById('existingStory').innerHTML = '<option value="">Could not load stories</option>';
      }
    }

    function populatePublishStorySelect(stories) {
      const select = document.getElementById('existingStory');

      const storyGroups = {};
      stories.forEach(function(story) {
        if (story.story_id) {
          if (!storyGroups[story.story_id]) {
            storyGroups[story.story_id] = {
              title: story.title,
              story_id: story.story_id,
              author: story.author,
              chapters: []
            };
          }
          storyGroups[story.story_id].chapters.push(story.chapter || 1);
        }
      });

      const groupList = Object.values(storyGroups);

      if (groupList.length === 0) {
        select.innerHTML = '<option value="">No multi-chapter stories found</option>';
        return;
      }

      select.innerHTML = '<option value="">Select a story...</option>';
      groupList.forEach(function(group) {
        const maxChapter = Math.max(...group.chapters);
        const option = document.createElement('option');
        option.value = group.story_id;
        option.textContent = group.title + ' by ' + group.author + ' (' + group.chapters.length + ' chapter' + (group.chapters.length > 1 ? 's' : '') + ')';
        option.dataset.nextChapter = maxChapter + 1;
        option.dataset.title = group.title;
        option.dataset.author = group.author;
        select.appendChild(option);
      });

      select.addEventListener('change', function() {
        const selected = this.options[this.selectedIndex];
        if (selected.dataset.nextChapter) {
          document.getElementById('chapterNumber').value = selected.dataset.nextChapter;
          document.getElementById('storyTitle').value = selected.dataset.title || '';
          document.getElementById('storyAuthor').value = selected.dataset.author || '';
        }
      });
    }

    const storyForm = document.getElementById('storyForm');
    if (storyForm) {
      storyForm.addEventListener('submit', handleStorySubmit);
    }

    async function handleStorySubmit(e) {
      e.preventDefault();

      const submitBtn = document.getElementById('submitBtn');
      const btnText = submitBtn.querySelector('.btn-text');
      const btnLoading = submitBtn.querySelector('.btn-loading');

      btnText.style.display = 'none';
      btnLoading.style.display = 'inline';
      submitBtn.disabled = true;

      const title = document.getElementById('storyTitle').value.trim();
      const author = document.getElementById('storyAuthor').value.trim();
      const tagsInput = document.getElementById('storyTags').value.trim();
      const content = document.getElementById('storyContent').value;
      const chapterType = document.querySelector('input[name="chapterType"]:checked').value;
      const chapterNumber = document.getElementById('chapterNumber') ? document.getElementById('chapterNumber').value : null;
      const chapterTitle = document.getElementById('chapterTitle') ? document.getElementById('chapterTitle').value.trim() : '';
      const existingStory = document.getElementById('existingStory') ? document.getElementById('existingStory').value : '';
      const description = document.getElementById('storyDescription') ? document.getElementById('storyDescription').value.trim() : '';

      const tags = tagsInput
        ? tagsInput.split(',').map(function(tag) { return tag.trim(); }).filter(function(tag) { return tag.length > 0; })
        : [];

      const date = new Date();
      const frontMatter = generateFrontMatter(title, author, date, tags, chapterType, chapterNumber, chapterTitle, existingStory, description);
      const fullContent = frontMatter + '\n' + content;

      try {
        const token = sessionStorage.getItem(TOKEN_KEY) || '';
        const response = await fetch(SUBMIT_URL, {
          method: 'POST',
          headers: Object.assign(
            { 'Content-Type': 'application/json' },
            token ? { 'Authorization': 'Bearer ' + token } : {}
          ),
          credentials: 'include',
          body: JSON.stringify({
            title: title,
            author: author,
            content: fullContent,
            tags: tags,
            chapterType: chapterType,
            chapterNumber: chapterNumber ? parseInt(chapterNumber) : null,
            storyId: existingStory || (chapterType === 'new-series' ? slugify(title) : null)
          })
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error('Server error: ' + response.status + ' ' + body);
        }

        storyForm.style.display = 'none';
        document.getElementById('submissionSuccess').style.display = 'block';

      } catch (error) {
        console.error('Submission error:', error);
        storyForm.style.display = 'none';
        document.getElementById('submissionError').style.display = 'block';
        document.getElementById('submitErrorDetails').textContent = error.message;
      } finally {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
      }
    }
  }

  // ── Edit Form ───────────────────────────────────────────────────────────────

  function initEditForm() {
    const storySelect = document.getElementById('storySelect');
    loadStories();

    async function loadStories() {
      try {
        const response = await fetch('/stories.json');
        if (response.ok) {
          const stories = await response.json();
          populateEditStorySelect(stories);
        } else {
          storySelect.innerHTML = '<option value="">Could not load stories</option>';
        }
      } catch (e) {
        storySelect.innerHTML = '<option value="">Could not load stories</option>';
      }
    }

    function populateEditStorySelect(stories) {
      if (!stories || stories.length === 0) {
        storySelect.innerHTML = '<option value="">No stories found</option>';
        return;
      }
      storySelect.innerHTML = '<option value="">Select a story to edit...</option>';
      stories.forEach(function(story) {
        const option = document.createElement('option');
        option.value = story.slug || story.url;
        let label = story.title;
        if (story.author) label += ' \u2014 ' + story.author;
        if (story.chapter) label += ' (Ch. ' + story.chapter + ')';
        option.textContent = label;
        option.dataset.story = JSON.stringify(story);
        storySelect.appendChild(option);
      });

      storySelect.addEventListener('change', function() {
        const selected = this.options[this.selectedIndex];
        if (selected.dataset.story) {
          const story = JSON.parse(selected.dataset.story);
          populateEditForm(story);
        }
      });
    }

    function populateEditForm(story) {
      const storyPreview = document.getElementById('storyPreview');
      const currentFilePath = document.getElementById('currentFilePath');

      if (storyPreview) storyPreview.style.display = 'block';
      if (currentFilePath) currentFilePath.value = story.url || '';

      const editTitle = document.getElementById('editTitle');
      const editAuthor = document.getElementById('editAuthor');
      const editDate = document.getElementById('editDate');
      const editTags = document.getElementById('editTags');
      const editDescription = document.getElementById('editDescription');
      const editStoryId = document.getElementById('editStoryId');
      const editChapter = document.getElementById('editChapter');
      const editChapterTitle = document.getElementById('editChapterTitle');

      if (editTitle) editTitle.value = story.title || '';
      if (editAuthor) editAuthor.value = story.author || '';
      if (editDate) editDate.value = story.date || '';
      if (editTags) editTags.value = Array.isArray(story.tags) ? story.tags.join(', ') : (story.tags || '');
      if (editDescription) editDescription.value = story.description || '';
      if (editStoryId) editStoryId.value = story.story_id || '';
      if (editChapter) editChapter.value = story.chapter || '';
      if (editChapterTitle) editChapterTitle.value = story.chapter_title || '';

      const editStoryContent = document.getElementById('editStoryContent');
      if (editStoryContent) editStoryContent.value = '';
    }

    const storyEditForm = document.getElementById('storyEditForm');
    if (storyEditForm) {
      storyEditForm.addEventListener('submit', handleEditSubmit);
    }

    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', handleDeleteClick);
    }

    async function handleDeleteClick() {
      const storyUrl = storySelect.value;
      if (!storyUrl) {
        alert('Please select a story to delete.');
        return;
      }

      const selectedOption = storySelect.options[storySelect.selectedIndex];
      const storyTitle = selectedOption ? selectedOption.textContent : storyUrl;
      if (!confirm('Are you sure you want to permanently delete "' + storyTitle + '"? This action cannot be undone.')) {
        return;
      }

      const btnText = deleteBtn.querySelector('.btn-text');
      const btnLoading = deleteBtn.querySelector('.btn-loading');

      btnText.style.display = 'none';
      btnLoading.style.display = 'inline';
      deleteBtn.disabled = true;

      try {
        const token = sessionStorage.getItem(TOKEN_KEY) || '';
        const response = await fetch(DELETE_URL, {
          method: 'POST',
          headers: Object.assign(
            { 'Content-Type': 'application/json' },
            token ? { 'Authorization': 'Bearer ' + token } : {}
          ),
          credentials: 'include',
          body: JSON.stringify({ storyUrl: storyUrl })
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error('Server error: ' + response.status + ' ' + body);
        }

        storyEditForm.style.display = 'none';
        document.getElementById('deleteSuccess').style.display = 'block';

      } catch (error) {
        console.error('Delete error:', error);
        storyEditForm.style.display = 'none';
        document.getElementById('deleteError').style.display = 'block';
        document.getElementById('deleteErrorDetails').textContent = error.message;
      } finally {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        deleteBtn.disabled = false;
      }
    }

    async function handleEditSubmit(e) {
      e.preventDefault();

      const updateBtn = document.getElementById('updateBtn');
      const btnText = updateBtn.querySelector('.btn-text');
      const btnLoading = updateBtn.querySelector('.btn-loading');

      btnText.style.display = 'none';
      btnLoading.style.display = 'inline';
      updateBtn.disabled = true;

      const storyUrl = storySelect.value;
      const title = document.getElementById('editTitle').value.trim();
      const author = document.getElementById('editAuthor').value.trim();
      const date = document.getElementById('editDate').value;
      const tagsInput = document.getElementById('editTags').value.trim();
      const description = document.getElementById('editDescription').value.trim();
      const storyId = document.getElementById('editStoryId').value.trim();
      const chapter = document.getElementById('editChapter').value;
      const chapterTitle = document.getElementById('editChapterTitle').value.trim();
      const content = document.getElementById('editStoryContent').value;

      const tags = tagsInput
        ? tagsInput.split(',').map(function(tag) { return tag.trim(); }).filter(function(tag) { return tag.length > 0; })
        : [];

      try {
        const token = sessionStorage.getItem(TOKEN_KEY) || '';
        const response = await fetch(EDIT_URL, {
          method: 'POST',
          headers: Object.assign(
            { 'Content-Type': 'application/json' },
            token ? { 'Authorization': 'Bearer ' + token } : {}
          ),
          credentials: 'include',
          body: JSON.stringify({
            storyUrl: storyUrl,
            title: title,
            author: author,
            date: date,
            tags: tags,
            description: description,
            storyId: storyId,
            chapter: chapter ? parseInt(chapter, 10) : null,
            chapterTitle: chapterTitle,
            content: content
          })
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error('Server error: ' + response.status + ' ' + body);
        }

        storyEditForm.style.display = 'none';
        document.getElementById('editSuccess').style.display = 'block';

      } catch (error) {
        console.error('Edit error:', error);
        storyEditForm.style.display = 'none';
        document.getElementById('editError').style.display = 'block';
        document.getElementById('editErrorDetails').textContent = error.message;
      } finally {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        updateBtn.disabled = false;
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function generateFrontMatter(title, author, date, tags, chapterType, chapterNumber, chapterTitle, existingStoryId, description) {
    const dateStr = date.toISOString().replace('T', ' ').substring(0, 19) + ' -0500';

    function escapeYaml(str) {
      return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    let yaml = '---\n'
      + 'layout: story\n'
      + 'title: "' + escapeYaml(title) + '"\n'
      + 'author: "' + escapeYaml(author) + '"\n'
      + 'date: ' + dateStr + '\n';

    if (description) {
      yaml += 'description: "' + escapeYaml(description) + '"\n';
    }

    if (chapterType === 'new-series') {
      yaml += 'story_id: "' + slugify(title) + '"\n';
      yaml += 'chapter: ' + (chapterNumber || 1) + '\n';
      if (chapterTitle) {
        yaml += 'chapter_title: "' + escapeYaml(chapterTitle) + '"\n';
      }
    } else if (chapterType === 'add-chapter' && existingStoryId) {
      yaml += 'story_id: "' + existingStoryId + '"\n';
      yaml += 'chapter: ' + (chapterNumber || 1) + '\n';
      if (chapterTitle) {
        yaml += 'chapter_title: "' + escapeYaml(chapterTitle) + '"\n';
      }
    }

    if (tags.length > 0) {
      yaml += 'tags:\n';
      tags.forEach(function(tag) {
        yaml += '  - ' + tag + '\n';
      });
    }

    yaml += '---\n\n';
    return yaml;
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }
});

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
const GET_STORY_CONTENT_URL = `${API_BASE}/api/get-story-content`;
const UPLOAD_ARTWORK_URL = `${API_BASE}/api/upload-artwork`;

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
  const editContent = document.getElementById('editTabContent');

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
   'editArtImage', 'editArtAlt', 'editArtCaption',
   'editStoryId', 'editChapter', 'editChapterTitle', 'editContent'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  ['editStoryArtworkPreview', 'publishStoryArtworkPreview'].forEach(function(id) {
    const preview = document.getElementById(id);
    if (preview) {
      preview.innerHTML = '';
      preview.style.display = 'none';
    }
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
    const existingStorySelect = document.getElementById('existingStory');
    const publishArtworkPreview = ensureArtworkPreviewContainer('publishStoryArtworkPreview', existingStoryGroup);
    setupArtworkUploader({
      fileInputId: 'storyArtFile',
      uploadBtnId: 'storyArtUploadBtn',
      statusId: 'storyArtUploadStatus',
      urlInputId: 'storyArtImage',
      titleInputId: 'storyTitle'
    });

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
        const artImageInput = document.getElementById('storyArtImage');
        const artAltInput = document.getElementById('storyArtAlt');
        const artCaptionInput = document.getElementById('storyArtCaption');
        if (artImageInput) artImageInput.value = '';
        if (artAltInput) artAltInput.value = '';
        if (artCaptionInput) artCaptionInput.value = '';
        renderStoryArtworkPreview(publishArtworkPreview, null);
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
              art_image: story.art_image || '',
              art_alt: story.art_alt || '',
              art_caption: story.art_caption || '',
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
        option.dataset.artImage = group.art_image;
        option.dataset.artAlt = group.art_alt;
        option.dataset.artCaption = group.art_caption;
        select.appendChild(option);
      });

      select.addEventListener('change', function() {
        const selected = this.options[this.selectedIndex];
        const artImageInput = document.getElementById('storyArtImage');
        const artAltInput = document.getElementById('storyArtAlt');
        const artCaptionInput = document.getElementById('storyArtCaption');

        if (selected.dataset.nextChapter) {
          document.getElementById('chapterNumber').value = selected.dataset.nextChapter;
          document.getElementById('storyTitle').value = selected.dataset.title || '';
          document.getElementById('storyAuthor').value = selected.dataset.author || '';
          if (artImageInput) artImageInput.value = selected.dataset.artImage || '';
          if (artAltInput) artAltInput.value = selected.dataset.artAlt || '';
          if (artCaptionInput) artCaptionInput.value = selected.dataset.artCaption || '';
        } else {
          if (artImageInput) artImageInput.value = '';
          if (artAltInput) artAltInput.value = '';
          if (artCaptionInput) artCaptionInput.value = '';
        }
        renderStoryArtworkPreview(publishArtworkPreview, {
          title: selected.dataset.title || '',
          art_image: selected.dataset.artImage || '',
          art_alt: selected.dataset.artAlt || '',
          art_caption: selected.dataset.artCaption || ''
        });
      });

      if (existingStorySelect) {
        const initial = existingStorySelect.options[existingStorySelect.selectedIndex];
        renderStoryArtworkPreview(publishArtworkPreview, {
          title: (initial && initial.dataset && initial.dataset.title) || '',
          art_image: (initial && initial.dataset && initial.dataset.artImage) || '',
          art_alt: (initial && initial.dataset && initial.dataset.artAlt) || '',
          art_caption: (initial && initial.dataset && initial.dataset.artCaption) || ''
        });
      }
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
      const artImage = document.getElementById('storyArtImage') ? document.getElementById('storyArtImage').value.trim() : '';
      const artAlt = document.getElementById('storyArtAlt') ? document.getElementById('storyArtAlt').value.trim() : '';
      const artCaption = document.getElementById('storyArtCaption') ? document.getElementById('storyArtCaption').value.trim() : '';

      const tags = tagsInput
        ? tagsInput.split(',').map(function(tag) { return tag.trim(); }).filter(function(tag) { return tag.length > 0; })
        : [];

      const date = new Date();
      const frontMatter = generateFrontMatter(title, author, date, tags, chapterType, chapterNumber, chapterTitle, existingStory, description, artImage, artAlt, artCaption);
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
    const editArtworkPreview = ensureArtworkPreviewContainer('editStoryArtworkPreview', storySelect ? storySelect.parentElement : null);
    let contentLoadToken = 0;
    let editStoriesByKey = {};
    setupArtworkUploader({
      fileInputId: 'editArtFile',
      uploadBtnId: 'editArtUploadBtn',
      statusId: 'editArtUploadStatus',
      urlInputId: 'editArtImage',
      titleInputId: 'editTitle'
    });
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
      editStoriesByKey = {};
      storySelect.innerHTML = '<option value="">Select a story to edit...</option>';
      stories.forEach(function(story) {
        const option = document.createElement('option');
        const optionKey = story.slug || story.url;
        option.value = optionKey;
        let label = story.title;
        if (story.author) label += ' \u2014 ' + story.author;
        if (story.chapter) label += ' (Ch. ' + story.chapter + ')';
        option.textContent = label;
        storySelect.appendChild(option);
        if (optionKey) {
          editStoriesByKey[optionKey] = story;
        }
      });

      storySelect.addEventListener('change', function() {
        const selectedKey = this.value;
        const story = selectedKey ? editStoriesByKey[selectedKey] : null;
        if (story) {
          populateEditForm(story);
          renderStoryArtworkPreview(editArtworkPreview, story);
        } else {
          renderStoryArtworkPreview(editArtworkPreview, null);
        }
      });
    }

    function populateEditForm(story) {
      const storyPreview = document.getElementById('storyPreview');
      const currentFilePath = document.getElementById('currentFilePath');

      if (storyPreview) storyPreview.style.display = 'block';
      if (currentFilePath) {
        currentFilePath.value = story.slug ? `_stories/${story.slug}.md` : (story.url || '');
      }

      const editTitle = document.getElementById('editTitle');
      const editAuthor = document.getElementById('editAuthor');
      const editDate = document.getElementById('editDate');
      const editTags = document.getElementById('editTags');
      const editDescription = document.getElementById('editDescription');
      const editArtImage = document.getElementById('editArtImage');
      const editArtAlt = document.getElementById('editArtAlt');
      const editArtCaption = document.getElementById('editArtCaption');
      const editStoryId = document.getElementById('editStoryId');
      const editChapter = document.getElementById('editChapter');
      const editChapterTitle = document.getElementById('editChapterTitle');

      if (editTitle) editTitle.value = story.title || '';
      if (editAuthor) editAuthor.value = story.author || '';
      if (editDate) editDate.value = story.date || '';
      if (editTags) editTags.value = Array.isArray(story.tags) ? story.tags.join(', ') : (story.tags || '');
      if (editDescription) editDescription.value = story.description || '';
      if (editArtImage) editArtImage.value = story.art_image || '';
      if (editArtAlt) editArtAlt.value = story.art_alt || '';
      if (editArtCaption) editArtCaption.value = story.art_caption || '';
      if (editStoryId) editStoryId.value = story.story_id || '';
      if (editChapter) editChapter.value = story.chapter || '';
      if (editChapterTitle) editChapterTitle.value = story.chapter_title || '';

      const editContent = document.getElementById('editContent');
      if (editContent) {
        loadStoryContentForEdit(story, editContent);
      }
    }

    async function loadStoryContentForEdit(story, editContent) {
      const statusEl = document.getElementById('editContentLoadStatus');
      
      const slug = (story && story.slug ? String(story.slug).trim() : '');
      if (!slug) {
        editContent.disabled = false;
        editContent.value = '';
        if (statusEl) statusEl.textContent = '';
        return;
      }

      const thisLoadToken = ++contentLoadToken;
      editContent.disabled = true;
      editContent.value = 'Loading story content...';
      if (statusEl) statusEl.textContent = 'Loading story markdown...';

      try {
        // Always fetch fresh content from API or GitHub to get latest edits
        const token = sessionStorage.getItem(TOKEN_KEY) || '';
        const response = await fetch(GET_STORY_CONTENT_URL, {
          method: 'POST',
          headers: Object.assign(
            { 'Content-Type': 'application/json' },
            token ? { 'Authorization': 'Bearer ' + token } : {}
          ),
          credentials: 'include',
          body: JSON.stringify({ slug: slug })
        });

        let markdown = '';
        if (response.ok) {
          const payload = await response.json();
          markdown = payload.content || '';
        } else {
          // Fallback to GitHub raw (with no-cache to get latest)
          const rawUrl = 'https://raw.githubusercontent.com/cheekypubs/cheekypubs.github.io/main/_stories/' + encodeURIComponent(slug) + '.md';
          const rawResp = await fetch(rawUrl, { cache: 'no-store' });
          if (!rawResp.ok) {
            throw new Error('Could not load source (' + rawResp.status + ')');
          }
          markdown = await rawResp.text();
        }

        if (thisLoadToken !== contentLoadToken) return;

        // Extract front matter and update artwork fields with fresh data
        const frontMatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
        if (frontMatterMatch) {
          const frontMatter = frontMatterMatch[1];
          
          // Parse artwork fields from front matter
          const artImageMatch = frontMatter.match(/art_image:\s*["']?([^"'\n]+)["']?/);
          const artAltMatch = frontMatter.match(/art_alt:\s*["']?([^"'\n]+)["']?/);
          const artCaptionMatch = frontMatter.match(/art_caption:\s*["']?([^"'\n]+)["']?/);
          
          // Update artwork fields with fresh values
          const editArtImage = document.getElementById('editArtImage');
          const editArtAlt = document.getElementById('editArtAlt');
          const editArtCaption = document.getElementById('editArtCaption');
          
          if (editArtImage && artImageMatch) editArtImage.value = artImageMatch[1].trim();
          if (editArtAlt && artAltMatch) editArtAlt.value = artAltMatch[1].trim();
          if (editArtCaption && artCaptionMatch) editArtCaption.value = artCaptionMatch[1].trim();
        }

        const contentOnly = markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
        editContent.value = contentOnly;
        if (statusEl) statusEl.textContent = 'Loaded story markdown.';
      } catch (error) {
        if (thisLoadToken !== contentLoadToken) return;
        editContent.value = '';
        editContent.placeholder = 'Could not auto-load story content. You can paste content manually.';
        if (statusEl) {
          const msg = (error && error.message) ? error.message : 'unknown error';
          statusEl.textContent = 'Could not auto-load markdown for this story (' + msg + ').';
        }
        console.error('Failed to load story content for edit:', error);
      } finally {
        if (thisLoadToken === contentLoadToken) {
          editContent.disabled = false;
        }
      }
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
      const artImage = document.getElementById('editArtImage').value.trim();
      const artAlt = document.getElementById('editArtAlt').value.trim();
      const artCaption = document.getElementById('editArtCaption').value.trim();
      const storyId = document.getElementById('editStoryId').value.trim();
      const chapter = document.getElementById('editChapter').value;
      const chapterTitle = document.getElementById('editChapterTitle').value.trim();
      const content = document.getElementById('editContent').value;

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
            artImage: artImage,
            artAlt: artAlt,
            artCaption: artCaption,
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

  function generateFrontMatter(title, author, date, tags, chapterType, chapterNumber, chapterTitle, existingStoryId, description, artImage, artAlt, artCaption) {
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

    if (artImage) {
      yaml += 'art_image: "' + escapeYaml(artImage) + '"\n';
    }

    if (artAlt) {
      yaml += 'art_alt: "' + escapeYaml(artAlt) + '"\n';
    }

    if (artCaption) {
      yaml += 'art_caption: "' + escapeYaml(artCaption) + '"\n';
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

  function ensureArtworkPreviewContainer(id, parent) {
    if (!parent) return null;
    let container = document.getElementById(id);
    if (container) return container;

    container = document.createElement('div');
    container.id = id;
    container.className = 'admin-story-artwork-preview';
    container.style.display = 'none';
    parent.appendChild(container);
    return container;
  }

  function renderStoryArtworkPreview(container, story) {
    if (!container) return;

    if (!story || !story.art_image) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    const title = escapeHtml(story.title || 'Selected story');
    const src = escapeHtml(story.art_image);
    const alt = escapeHtml(story.art_alt || story.title || 'Story artwork');
    const caption = story.art_caption ? '<figcaption>' + escapeHtml(story.art_caption) + '</figcaption>' : '';

    container.innerHTML = ''
      + '<p class="admin-story-artwork-label">Artwork preview for <strong>' + title + '</strong></p>'
      + '<figure class="admin-story-artwork-figure">'
      + '<img src="' + src + '" alt="' + alt + '">'
      + caption
      + '</figure>';
    container.style.display = 'block';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setupArtworkUploader(config) {
    const fileInput = document.getElementById(config.fileInputId);
    const uploadBtn = document.getElementById(config.uploadBtnId);
    const statusEl = document.getElementById(config.statusId);
    const urlInput = document.getElementById(config.urlInputId);

    if (!fileInput || !uploadBtn || !statusEl || !urlInput) return;

    uploadBtn.addEventListener('click', async function() {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        statusEl.textContent = 'Please select a file first.';
        return;
      }

      const extMatch = (file.name || '').toLowerCase().match(/\.(svg|png|jpe?g|webp|gif)$/);
      if (!extMatch) {
        statusEl.textContent = 'Unsupported file type. Use svg, png, jpg, jpeg, webp, or gif.';
        return;
      }

      uploadBtn.disabled = true;
      statusEl.textContent = 'Uploading artwork...';

      try {
        const dataUrl = await readFileAsDataUrl(file);
        const parts = dataUrl.split(',');
        const base64Data = parts.length > 1 ? parts[1] : '';
        if (!base64Data) {
          throw new Error('Invalid file data');
        }

        const titleInput = config.titleInputId ? document.getElementById(config.titleInputId) : null;
        const titleStem = titleInput && titleInput.value ? slugify(titleInput.value) : 'artwork';
        const finalName = `${titleStem || 'artwork'}-${Date.now()}.${extMatch[1] === 'jpeg' ? 'jpg' : extMatch[1]}`;

        const token = sessionStorage.getItem(TOKEN_KEY) || '';
        const response = await fetch(UPLOAD_ARTWORK_URL, {
          method: 'POST',
          headers: Object.assign(
            { 'Content-Type': 'application/json' },
            token ? { 'Authorization': 'Bearer ' + token } : {}
          ),
          credentials: 'include',
          body: JSON.stringify({ fileName: finalName, fileDataBase64: base64Data })
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || ('Upload failed: ' + response.status));
        }

        const payload = await response.json();
        urlInput.value = payload.path || '';
        statusEl.textContent = payload.path ? `Uploaded: ${payload.path}` : 'Upload complete.';
      } catch (error) {
        console.error('Artwork upload failed:', error);
        statusEl.textContent = 'Upload failed. Check file and try again.';
      } finally {
        uploadBtn.disabled = false;
      }
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function() { resolve(reader.result || ''); };
      reader.onerror = function() { reject(new Error('Failed to read file')); };
      reader.readAsDataURL(file);
    });
  }
});

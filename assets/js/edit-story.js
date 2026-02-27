/**
 * Admin Story Editing JavaScript
 * Handles password authentication and story editing via Vercel API
 */

// Vercel API endpoints (absolute URLs for cross-origin from GitHub Pages)
const API_BASE = 'https://cheekypubs.vercel.app';
const LOGIN_URL = `${API_BASE}/api/login`;
const EDIT_URL = `${API_BASE}/api/edit-story`;
const DELETE_URL = `${API_BASE}/api/delete-story`;

document.addEventListener('DOMContentLoaded', function() {
  const passwordGate = document.getElementById('passwordGate');
  const editingForm = document.getElementById('editingForm');
  const passwordInput = document.getElementById('passwordInput');
  const passwordSubmit = document.getElementById('passwordSubmit');
  const passwordError = document.getElementById('passwordError');
  const storyEditForm = document.getElementById('storyEditForm');
  const storySelect = document.getElementById('storySelect');

  // Check if already authenticated (session storage)
  if (sessionStorage.getItem('storyEditAuth') === 'true' && sessionStorage.getItem('storyEditToken')) {
    showEditingForm();
  } else {
    // Clear any stale auth state
    sessionStorage.removeItem('storyEditAuth');
    sessionStorage.removeItem('storyEditToken');
  }

  // Password submission - authenticates against server-side API
  if (passwordSubmit) {
    passwordSubmit.addEventListener('click', checkPassword);
    passwordInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        checkPassword();
      }
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

      // Authenticated — store token from response body (cross-origin cookies are often
      // blocked by browsers, so we use the token directly via Authorization header)
      const data = await resp.json().catch(() => ({}));
      if (data.token) {
        sessionStorage.setItem('storyEditToken', data.token);
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

  // Load stories into the select dropdown
  async function loadStories() {
    try {
      const response = await fetch('/stories.json');
      if (response.ok) {
        const stories = await response.json();
        populateStorySelect(stories);
      } else {
        storySelect.innerHTML = '<option value="">Could not load stories</option>';
      }
    } catch (e) {
      storySelect.innerHTML = '<option value="">Could not load stories</option>';
    }
  }

  function populateStorySelect(stories) {
    if (!stories || stories.length === 0) {
      storySelect.innerHTML = '<option value="">No stories found</option>';
      return;
    }
    storySelect.innerHTML = '<option value="">Select a story to edit...</option>';
    stories.forEach(story => {
      const option = document.createElement('option');
      option.value = story.slug || story.url;
      let label = story.title;
      if (story.author) label += ` — ${story.author}`;
      if (story.chapter) label += ` (Ch. ${story.chapter})`;
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

    // Clear content area (content is not available from stories.json index)
    const editContent = document.getElementById('editContent');
    if (editContent) editContent.value = '';
  }

  // Story edit form submission
  if (storyEditForm) {
    storyEditForm.addEventListener('submit', handleEditSubmit);
  }

  // Delete button handler
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
    if (!confirm(`Are you sure you want to permanently delete "${storyTitle}"? This action cannot be undone.`)) {
      return;
    }

    const btnText = deleteBtn.querySelector('.btn-text');
    const btnLoading = deleteBtn.querySelector('.btn-loading');

    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    deleteBtn.disabled = true;

    try {
      const editToken = sessionStorage.getItem('storyEditToken') || '';
      const response = await fetch(DELETE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(editToken && { 'Authorization': `Bearer ${editToken}` })
        },
        credentials: 'include',
        body: JSON.stringify({ storyUrl })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Server error: ${response.status} ${body}`);
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

    // Show loading state
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
    const content = document.getElementById('editContent').value;

    const tags = tagsInput
      ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      : [];

    try {
      const editToken = sessionStorage.getItem('storyEditToken') || '';
      const response = await fetch(EDIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(editToken && { 'Authorization': `Bearer ${editToken}` })
        },
        credentials: 'include',
        body: JSON.stringify({
          storyUrl,
          title,
          author,
          date,
          tags,
          description,
          storyId,
          chapter: chapter ? parseInt(chapter, 10) : null,
          chapterTitle,
          content
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Server error: ${response.status} ${body}`);
      }

      // Show success message
      storyEditForm.style.display = 'none';
      document.getElementById('editSuccess').style.display = 'block';

    } catch (error) {
      console.error('Edit error:', error);
      storyEditForm.style.display = 'none';
      document.getElementById('editError').style.display = 'block';
      document.getElementById('errorDetails').textContent = error.message;
    } finally {
      // Reset button state
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
      updateBtn.disabled = false;
    }
  }
});

function clearForm() {
  const storySelect = document.getElementById('storySelect');
  if (storySelect) storySelect.value = '';

  const storyPreview = document.getElementById('storyPreview');
  if (storyPreview) storyPreview.style.display = 'none';

  ['editTitle', 'editAuthor', 'editDate', 'editTags', 'editDescription',
   'editStoryId', 'editChapter', 'editChapterTitle', 'editContent'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}
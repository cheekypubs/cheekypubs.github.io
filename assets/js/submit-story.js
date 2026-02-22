/**
 * Admin Story Submission JavaScript
 * Handles password authentication and story submission to GitHub via Vercel API
 * Supports multi-chapter stories
 */

// Vercel API endpoints (absolute URLs for cross-origin from GitHub Pages)
const API_BASE = 'https://cheekypubs.vercel.app';
const LOGIN_URL = `${API_BASE}/api/login`;
const SUBMIT_URL = `${API_BASE}/api/submit-story`;

// Store multi-chapter stories for the dropdown
let multiChapterStories = [];

document.addEventListener('DOMContentLoaded', function() {
  const passwordGate = document.getElementById('passwordGate');
  const submissionForm = document.getElementById('submissionForm');
  const passwordInput = document.getElementById('passwordInput');
  const passwordSubmit = document.getElementById('passwordSubmit');
  const passwordError = document.getElementById('passwordError');
  const storyForm = document.getElementById('storyForm');

  // Chapter type form elements
  const chapterTypeRadios = document.querySelectorAll('input[name="chapterType"]');
  const existingStoryGroup = document.getElementById('existingStoryGroup');
  const chapterNumberGroup = document.getElementById('chapterNumberGroup');
  const chapterTitleGroup = document.getElementById('chapterTitleGroup');
  const existingStorySelect = document.getElementById('existingStory');

  // Check if already authenticated (session storage)
  if (sessionStorage.getItem('storySubmitAuth') === 'true') {
    showSubmissionForm();
  }

  // Chapter type radio button handling
  if (chapterTypeRadios) {
    chapterTypeRadios.forEach(radio => {
      radio.addEventListener('change', handleChapterTypeChange);
    });
  }

  function handleChapterTypeChange(e) {
    const type = e.target.value;
    
    // Hide all chapter-related fields first
    existingStoryGroup.style.display = 'none';
    chapterNumberGroup.style.display = 'none';
    chapterTitleGroup.style.display = 'none';
    
    if (type === 'standalone') {
      // No extra fields needed
    } else if (type === 'new-series') {
      // Show chapter number (starts at 1) and optional title
      chapterNumberGroup.style.display = 'block';
      chapterTitleGroup.style.display = 'block';
      document.getElementById('chapterNumber').value = '1';
    } else if (type === 'add-chapter') {
      // Show existing story dropdown and chapter fields
      existingStoryGroup.style.display = 'block';
      chapterNumberGroup.style.display = 'block';
      chapterTitleGroup.style.display = 'block';
      loadExistingStories();
    }
  }

  // Load existing multi-chapter stories from Jekyll data
  async function loadExistingStories() {
    const select = document.getElementById('existingStory');
    
    // Try to fetch story data from the site
    try {
      // We'll need to parse stories from a JSON endpoint or the page
      // For now, populate from inline data if available
      if (window.existingStories && window.existingStories.length > 0) {
        populateStorySelect(window.existingStories);
      } else {
        // Fetch from a data file (we'll create this)
        const response = await fetch('/stories.json');
        if (response.ok) {
          const stories = await response.json();
          multiChapterStories = stories.filter(s => s.story_id);
          populateStorySelect(multiChapterStories);
        } else {
          select.innerHTML = '<option value="">No existing stories found</option>';
        }
      }
    } catch (e) {
      select.innerHTML = '<option value="">Could not load stories</option>';
    }
  }

  function populateStorySelect(stories) {
    const select = document.getElementById('existingStory');
    
    // Group by story_id
    const storyGroups = {};
    stories.forEach(story => {
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
    groupList.forEach(group => {
      const maxChapter = Math.max(...group.chapters);
      const option = document.createElement('option');
      option.value = group.story_id;
      option.textContent = `${group.title} by ${group.author} (${group.chapters.length} chapter${group.chapters.length > 1 ? 's' : ''})`;
      option.dataset.nextChapter = maxChapter + 1;
      option.dataset.title = group.title;
      option.dataset.author = group.author;
      select.appendChild(option);
    });
    
    // Update chapter number when story is selected
    select.addEventListener('change', function() {
      const selected = this.options[this.selectedIndex];
      if (selected.dataset.nextChapter) {
        document.getElementById('chapterNumber').value = selected.dataset.nextChapter;
        document.getElementById('storyTitle').value = selected.dataset.title || '';
        document.getElementById('storyAuthor').value = selected.dataset.author || '';
      }
    });
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

      // Authenticated — server set HttpOnly cookie; show submission form
      sessionStorage.setItem('storySubmitAuth', 'true');
      showSubmissionForm();
    } catch (e) {
      showPasswordError('Authentication failed');
    }
  }

  function showPasswordError(message) {
    passwordError.textContent = message;
    passwordError.style.display = 'block';
    passwordInput.classList.add('error');
  }

  function showSubmissionForm() {
    if (passwordGate) passwordGate.style.display = 'none';
    if (submissionForm) submissionForm.style.display = 'block';
  }

  // Story form submission
  if (storyForm) {
    storyForm.addEventListener('submit', handleStorySubmit);
  }

  async function handleStorySubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    // Show loading state
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    submitBtn.disabled = true;

    // Gather form data
    const title = document.getElementById('storyTitle').value.trim();
    const author = document.getElementById('storyAuthor').value.trim();
    const tagsInput = document.getElementById('storyTags').value.trim();
    const content = document.getElementById('storyContent').value;
    
    // Chapter info
    const chapterType = document.querySelector('input[name="chapterType"]:checked').value;
    const chapterNumber = document.getElementById('chapterNumber')?.value;
    const chapterTitle = document.getElementById('chapterTitle')?.value?.trim();
    const existingStory = document.getElementById('existingStory')?.value;
    const description = document.getElementById('storyDescription')?.value?.trim();

    // Parse tags
    const tags = tagsInput
      ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      : [];

    // Generate front matter and content
    const date = new Date();
    const frontMatter = generateFrontMatter(title, author, date, tags, chapterType, chapterNumber, chapterTitle, existingStory, description);
    const fullContent = `${frontMatter}\n${content}`;

    try {
      const response = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(`Server error: ${response.status} ${body}`);
      }

      // Show success message
      storyForm.style.display = 'none';
      document.getElementById('submissionSuccess').style.display = 'block';

    } catch (error) {
      console.error('Submission error:', error);
      storyForm.style.display = 'none';
      document.getElementById('submissionError').style.display = 'block';
      document.getElementById('errorDetails').textContent = error.message;
    } finally {
      // Reset button state
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
      submitBtn.disabled = false;
    }
  }

  function generateFrontMatter(title, author, date, tags, chapterType, chapterNumber, chapterTitle, existingStoryId, description) {
    const dateStr = date.toISOString().replace('T', ' ').substring(0, 19) + ' -0500';

    let yaml = `---
layout: story
title: "${title.replace(/"/g, '\\"')}"
author: "${author.replace(/"/g, '\\"')}"
date: ${dateStr}
`;

    // Add description if provided
    if (description) {
      yaml += `description: "${description.replace(/"/g, '\\"')}"\n`;
    }

    // Add chapter info for multi-chapter stories
    if (chapterType === 'new-series') {
      yaml += `story_id: "${slugify(title)}"\n`;
      yaml += `chapter: ${chapterNumber || 1}\n`;
      if (chapterTitle) {
        yaml += `chapter_title: "${chapterTitle.replace(/"/g, '\\"')}"\n`;
      }
    } else if (chapterType === 'add-chapter' && existingStoryId) {
      yaml += `story_id: "${existingStoryId}"\n`;
      yaml += `chapter: ${chapterNumber || 1}\n`;
      if (chapterTitle) {
        yaml += `chapter_title: "${chapterTitle.replace(/"/g, '\\"')}"\n`;
      }
    }

    if (tags.length > 0) {
      yaml += 'tags:\n';
      tags.forEach(tag => {
        yaml += `  - ${tag}\n`;
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

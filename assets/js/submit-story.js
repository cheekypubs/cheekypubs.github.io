/**
 * Admin Story Submission JavaScript
 * Handles password authentication and story submission to GitHub via Vercel API
 */

// Vercel API endpoints (absolute URLs for cross-origin from GitHub Pages)
const API_BASE = 'https://cheekypubs.vercel.app';
const LOGIN_URL = `${API_BASE}/api/login`;
const SUBMIT_URL = `${API_BASE}/api/submit-story`;

document.addEventListener('DOMContentLoaded', function() {
  const passwordGate = document.getElementById('passwordGate');
  const submissionForm = document.getElementById('submissionForm');
  const passwordInput = document.getElementById('passwordInput');
  const passwordSubmit = document.getElementById('passwordSubmit');
  const passwordError = document.getElementById('passwordError');
  const storyForm = document.getElementById('storyForm');

  // Check if already authenticated (session storage)
  if (sessionStorage.getItem('storySubmitAuth') === 'true') {
    showSubmissionForm();
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

    // Parse tags
    const tags = tagsInput
      ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      : [];

    // Generate front matter and content
    const date = new Date();
    const frontMatter = generateFrontMatter(title, author, date, tags);
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
          tags: tags
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

  function generateFrontMatter(title, author, date, tags) {
    const dateStr = date.toISOString().replace('T', ' ').substring(0, 19) + ' -0500';

    let yaml = `---
layout: story
title: "${title.replace(/"/g, '\\"')}"
author: "${author.replace(/"/g, '\\"')}"
date: ${dateStr}
`;

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

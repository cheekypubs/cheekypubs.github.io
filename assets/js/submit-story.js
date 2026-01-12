/**
 * Story Submission JavaScript
 * Handles password authentication and story submission to GitHub
 */

// Netlify Function URL
const STORY_SUBMIT_URL = 'https://cheekypub.netlify.app/.netlify/functions/submit-story';

document.addEventListener('DOMContentLoaded', function() {
  // CONFIGURATION: Set your submission password here
  // To generate a hash: in browser console, run: 
  // crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword')).then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('')))
  const PASSWORD_HASH = '9a82a0f82b48530ba7121311c23c6d895b18111d5665708b3f60c1552f24aa7b';
  
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
  
  // Password submission
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
    
    // Hash the entered password and compare
    const hash = await sha256(password);
    
    // Check against configured hash, or allow any 4+ char password if not configured
    if (PASSWORD_HASH !== 'SET_YOUR_PASSWORD_HASH_HERE' && hash === PASSWORD_HASH) {
      sessionStorage.setItem('storySubmitAuth', 'true');
      showSubmissionForm();
    } else if (PASSWORD_HASH === 'SET_YOUR_PASSWORD_HASH_HERE' && password.length >= 4) {
      // Fallback: accept any 4+ character password if hash not configured
      sessionStorage.setItem('storySubmitAuth', 'true');
      showSubmissionForm();
    } else {
      showPasswordError('Incorrect password. Please try again.');
    }
  }
  
  function showPasswordError(message) {
    passwordError.textContent = message;
    passwordError.style.display = 'block';
    passwordInput.classList.add('error');
  }
  
  function showSubmissionForm() {
    passwordGate.style.display = 'none';
    submissionForm.style.display = 'block';
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
    
    // Generate filename
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const slug = slugify(title);
    const filename = `${dateStr}-${slug}.md`;
    
    // Generate front matter and content
    const frontMatter = generateFrontMatter(title, author, date, tags);
    const fullContent = `${frontMatter}\n${content}`;
    
    try {
      // Submit to GitHub via API (requires a GitHub Actions workflow or serverless function)
      await submitToGitHub(filename, fullContent, title, author);
      
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
  
  async function submitToGitHub(filename, content, title, author) {
    // This function submits the story data via GitHub Issues
    // The issue will trigger a GitHub Action that processes and commits the story
    
    const submissionData = {
      filename: filename,
      content: btoa(unescape(encodeURIComponent(content))), // Base64 encode
      title: title,
      author: author,
      timestamp: new Date().toISOString()
    };
    
    // Create issue body in the format expected by the GitHub Action
    const issueTitle = `[Story Submission] ${title}`;
    const issueBody = `## New Story Submission

**Title:** ${title}
**Author:** ${author}
**Submitted:** ${new Date().toLocaleString()}

### Filename
\`${filename}\`

### Content (Base64 Encoded)
\`\`\`
${submissionData.content}
\`\`\`
`;
    
    // Store submission locally as backup
    const submissions = JSON.parse(localStorage.getItem('storySubmissions') || '[]');
    submissions.push({
      ...submissionData,
      issueTitle: issueTitle,
      issueBody: issueBody,
      submittedAt: new Date().toISOString()
    });
    localStorage.setItem('storySubmissions', JSON.stringify(submissions));
    
    // Try to submit via GitHub API if token is available
    // For public submissions without auth, we'll use a serverless function
    // or display instructions for manual submission
    
    try {
      // Submit to Cloudflare Worker (or other serverless function)
      if (STORY_SUBMIT_URL && !STORY_SUBMIT_URL.includes('YOUR-WORKER-NAME')) {
        const response = await fetch(STORY_SUBMIT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: issueTitle,
            body: issueBody,
            labels: ['story-submission']
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to submit story to server');
        }
        
        return response.json();
      } else {
        // Worker URL not configured - show manual instructions
        throw new Error('WORKER_NOT_CONFIGURED');
      }
      
    } catch (error) {
      console.error('Submission error:', error);
      
      if (error.message === 'WORKER_NOT_CONFIGURED') {
        // Show manual submission instructions
        throw new Error('The submission system is not fully configured. Your story has been saved locally. Please contact the site administrator.');
      }
      
      throw error;
    }
  }
  
  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }
  
  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
});

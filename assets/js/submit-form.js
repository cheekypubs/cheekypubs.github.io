// Public story submission form
(function () {
  const API_BASE = 'https://cheekypubs.vercel.app';
  const SUBMIT_PENDING_URL = API_BASE + '/api/submit-pending';

  var form = document.getElementById('storySubmissionForm');
  if (!form) return;

  var turnstileToken = '';
  window.onSubmitTurnstileSuccess = function (token) {
    turnstileToken = token;
  };

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var submitBtn = document.getElementById('submitStoryBtn');
    var btnText = submitBtn.querySelector('.btn-text');
    var btnLoading = submitBtn.querySelector('.btn-loading');
    var errorEl = document.getElementById('submitError');
    var successEl = document.getElementById('submitSuccess');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    var title = document.getElementById('submitTitle').value.trim();
    var content = document.getElementById('submitContent').value.trim();

    if (!title || !content) {
      errorEl.textContent = 'Title and story content are required.';
      errorEl.style.display = 'block';
      return;
    }

    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    submitBtn.disabled = true;

    var tagsInput = document.getElementById('submitTags').value.trim();
    var tags = tagsInput
      ? tagsInput.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
      : [];

    try {
      var response = await fetch(SUBMIT_PENDING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          author: document.getElementById('submitAuthor').value.trim(),
          tags: tags,
          description: document.getElementById('submitDescription').value.trim(),
          email: document.getElementById('submitEmail').value.trim(),
          content: content,
          website: document.getElementById('submitWebsite').value,
          turnstileToken: turnstileToken
        })
      });

      if (!response.ok) {
        var body = await response.json().catch(function () { return {}; });
        throw new Error(body.error || 'Submission failed. Please try again.');
      }

      form.reset();
      successEl.style.display = 'block';
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong. Please try again.';
      errorEl.style.display = 'block';
    } finally {
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
      submitBtn.disabled = false;
    }
  });
})();

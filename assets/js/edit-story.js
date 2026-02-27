// Complete vanilla JavaScript implementation for story editing

// Function to authenticate user
function authenticateUser(password) {
    const correctPassword = 'your_password'; // Change this to an environment variable
    return password === correctPassword;
}

// Function to load a story
function loadStory(storyId) {
    fetch(`https://your-vercel-backend.com/api/stories/${storyId}`)
    .then(response => response.json())
    .then(data => {
        populateForm(data);
    })
    .catch(error => console.error('Error loading story:', error));
}

// Function to populate the form with story data
function populateForm(data) {
    document.getElementById('storyTitle').value = data.title;
    document.getElementById('storyContent').value = data.content;
}

// Function to submit the form
function submitForm(event) {
    event.preventDefault();
    const storyId = document.getElementById('storyId').value;
    const title = document.getElementById('storyTitle').value;
    const content = document.getElementById('storyContent').value;

    const storyData = { title, content };

    fetch(`https://your-vercel-backend.com/api/stories/${storyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storyData)
    })
    .then(response => response.json())
    .then(data => {
        alert('Story updated successfully!');
    })
    .catch(error => console.error('Error updating story:', error));
}

// Event listener for form submission
document.getElementById('storyForm').addEventListener('submit', function(event) {
    const password = document.getElementById('password').value;
    if (authenticateUser(password)) {
        submitForm(event);
    } else {
        alert('Incorrect password.');
    }
});
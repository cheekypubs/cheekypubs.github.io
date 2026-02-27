// Complete Vanilla JavaScript Implementation for Story Editing

// Password Authentication
function authenticate(password) {
    const correctPassword = 'your_password'; // Change this to your password
    return password === correctPassword;
}

// Load stories from stories.json
async function loadStories() {
    try {
        const response = await fetch('stories.json');
        if (!response.ok) throw new Error('Network response was not ok');
        const stories = await response.json();
        return stories;
    } catch (error) {
        console.error('Failed to load stories:', error);
    }
}

// Populate form with story data
function populateForm(story) {
    document.getElementById('title').value = story.title;
    document.getElementById('content').value = story.content;
    // Add more fields as necessary
}

// Submit data to Vercel backend
async function submitStory(data) {
    try {
        const response = await fetch('https://your-vercel-backend-url/api/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const result = await response.json();
        console.log('Story submitted successfully:', result);
    } catch (error) {
        console.error('Failed to submit story:', error);
    }
}

// Main function to run the editing process
async function editStory() {
    const password = prompt('Enter the password:');
    if (!authenticate(password)) {
        alert('Password is incorrect!');
        return;
    }

    const stories = await loadStories();
    if (stories) {
        const storyId = '123'; // Get this ID dynamically based on selection
        const story = stories.find(s => s.id === storyId);
        if (story) {
            populateForm(story);
        }
    }

    const submitButton = document.getElementById('submit');
    submitButton.addEventListener('click', async () => {
        const data = {
            title: document.getElementById('title').value,
            content: document.getElementById('content').value,
            // Add more fields as necessary
        };
        await submitStory(data);
    });
}

// Call the editStory function to initiate
editStory();
// Complete Story Editing Functionality

// Imports and Dependencies
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const EditStory = () => {
    const [password, setPassword] = useState('');
    const [story, setStory] = useState(null);
    const [error, setError] = useState('');
    const storyId = 'YOUR_STORY_ID_HERE'; // Replace with dynamic story ID or pass as props

    // Load story based on storyId
    useEffect(() => {
        const loadStory = async () => {
            try {
                const response = await axios.get(`/api/stories/${storyId}`);
                setStory(response.data);
            } catch (err) {
                setError('Error loading story');
            }
        };
        loadStory();
    }, [storyId]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (password !== 'YOUR_PASSWORD_HERE') {
            setError('Invalid password');
            return;
        }

        try {
            await axios.post(`/api/stories/${storyId}`, story);
            alert('Story submitted successfully');
        } catch (err) {
            setError('Error submitting the story');
        }
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        setStory({ ...story, [name]: value });
    };

    return (
        <div>
            <h1>Edit Story</h1>
            {error && <p>{error}</p>}
            <form onSubmit={handleSubmit}>
                {story && (
                    <> 
                        <input 
                            type='text' 
                            name='title' 
                            value={story.title} 
                            onChange={handleChange} 
                            placeholder='Story Title' 
                        />
                        <textarea 
                            name='content' 
                            value={story.content} 
                            onChange={handleChange} 
                            placeholder='Story Content' 
                        />
                    </>
                )}
                <input 
                    type='password' 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder='Enter Password' 
                />
                <button type='submit'>Save Changes</button>
            </form>
        </div>
    );
};

export default EditStory;
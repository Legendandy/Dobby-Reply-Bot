// Fixed popup functionality
document.addEventListener('DOMContentLoaded', async function() {
    const apiKeyInput = document.getElementById('api-key');
    const saveButton = document.getElementById('save-key');
    const statusDot = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const replyCount = document.getElementById('reply-count');
    const resetStatsButton = document.getElementById('reset-stats');

    // Load saved settings
    const result = await chrome.storage.sync.get(['dobbyApiKey', 'dobbyStats']);
    
    if (result.dobbyApiKey) {
        apiKeyInput.value = result.dobbyApiKey;
        updateStatus(true, 'API Key configured');
    }

    if (result.dobbyStats) {
        replyCount.textContent = result.dobbyStats.repliesGenerated || 0;
    }

    // Save API key
    saveButton.addEventListener('click', async function() {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            alert('Please enter your API key');
            return;
        }

        try {
            // Test the API key
            saveButton.textContent = 'Testing...';
            saveButton.disabled = true;

            const isValid = await testApiKey(apiKey);
            
            if (isValid) {
                await chrome.storage.sync.set({ dobbyApiKey: apiKey });
                updateStatus(true, 'API Key saved successfully!');
                
                // Safely notify content script (don't wait for response)
                try {
                    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
                    if (tabs[0] && (tabs[0].url.includes('twitter.com') || tabs[0].url.includes('x.com'))) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'apiKeyUpdated',
                            apiKey: apiKey
                        }).catch(() => {
                            // Ignore connection errors - content script will pick up the key from storage
                            console.log('Content script not ready yet, but API key saved to storage');
                        });
                    }
                } catch (error) {
                    // Ignore - content script will load the key from storage when ready
                    console.log('Tab communication failed, but API key saved to storage');
                }
            } else {
                updateStatus(false, 'Invalid API key');
            }
        } catch (error) {
            updateStatus(false, 'Error testing API key');
        } finally {
            saveButton.textContent = 'Save';
            saveButton.disabled = false;
        }
    });

    // Reset stats
    resetStatsButton.addEventListener('click', async function() {
        await chrome.storage.sync.set({ 
            dobbyStats: { repliesGenerated: 0 } 
        });
        replyCount.textContent = '0';
    });

    function updateStatus(isOnline, message) {
        statusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
        statusText.textContent = message;
    }

    async function testApiKey(apiKey) {
        try {
            // Replace with your actual Vercel URL
            const response = await fetch('https://dobby-backend-five.vercel.app/api/generate-reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tweetContent: 'Test tweet for API validation',
                    apiKey: apiKey
                })
            });

            const data = await response.json();
            return response.ok && data.success;
        } catch (error) {
            console.error('API test failed:', error);
            return false;
        }
    }
});
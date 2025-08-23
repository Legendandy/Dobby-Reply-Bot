// Background service worker
chrome.runtime.onInstalled.addListener(function() {
    console.log('Dobby extension installed');
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'generateReply') {
        generateReply(request.tweetContent, request.apiKey)
            .then(reply => sendResponse({ success: true, reply }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
    }
});

async function generateReply(tweetContent, apiKey) {
    try {
        const response = await fetch('https://dobby-backend-five.vercel.app/api/generate-reply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tweetContent: tweetContent,
                apiKey: apiKey
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Unknown API error');
        }

        return data.reply;
    } catch (error) {
        console.error('Error generating reply:', error);
        throw error;
    }
}

// Update stats
async function updateStats() {
    const result = await chrome.storage.sync.get(['dobbyStats']);
    const stats = result.dobbyStats || { repliesGenerated: 0 };
    stats.repliesGenerated += 1;
    await chrome.storage.sync.set({ dobbyStats: stats });
}

// Listen for stats updates
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'incrementStats') {
        updateStats();
    }
});
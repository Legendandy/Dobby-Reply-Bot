import FireworksClient from '../lib/fireworks-client.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tweetContent, apiKey, userContext } = req.body;

    if (!tweetContent || !apiKey) {
      return res.status(400).json({ 
        error: 'Missing required fields: tweetContent and apiKey' 
      });
    }

    const fireworks = new FireworksClient(apiKey);
    const reply = await fireworks.generateReply(tweetContent, userContext);

    return res.status(200).json({ 
      success: true, 
      reply: reply 
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate reply',
      details: error.message 
    });
  }
}
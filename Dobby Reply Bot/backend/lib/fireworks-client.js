import axios from 'axios';

export default class FireworksClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.fireworks.ai/inference/v1/chat/completions';
  }

  async generateReply(tweetContent, userContext = null) {
    const prompt = this.buildPrompt(tweetContent, userContext);
    
    try {
      const response = await axios.post(this.baseURL, {
        model: "sentientfoundation-serverless/dobby-mini-unhinged-plus-llama-3-1-8b",
        messages: [
          {
            role: "system",
            content: "You are Dobby, a witty and helpful AI assistant that crafts perfect Twitter replies. Generate engaging, contextually appropriate responses that match the tone of the original tweet. Keep replies under 280 characters and make them likely to get engagement."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.8,
        top_p: 0.9
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Fireworks API Error:', error);
      throw new Error('Failed to generate reply');
    }
  }

  buildPrompt(tweetContent, userContext) {
    let prompt = `Generate a Twitter reply to this tweet: "${tweetContent}"

Requirements:
- Keep it under 140 characters
- Match the tone (professional, casual, humorous, etc.)
- Be engaging and conversation-worthy
- Don't just agree - add value or perspective
- Avoid generic responses like "Great post!"`;

    if (userContext) {
      prompt += `\n- User context: ${userContext}`;
    }

    prompt += "\n\nGenerate ONLY the reply text, no quotes or explanations:";
    
    return prompt;
  }
}
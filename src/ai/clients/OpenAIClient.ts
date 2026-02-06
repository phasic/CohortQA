import { AIClient, AIClientConfig } from '../AIClient.js';
import { PageContext, AIRecommendation } from '../types.js';

export class OpenAIClient extends AIClient {
  async call(context: PageContext): Promise<AIRecommendation> {
    const prompt = this.buildPrompt(context);

    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a test automation expert. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.config.temperature ?? 0.3,
        max_tokens: this.config.maxTokens ?? 300
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim() || '';
    
    return this.parseRecommendation(content, context);
  }
}


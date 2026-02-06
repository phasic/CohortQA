import { AIClient, AIClientConfig } from '../AIClient.js';
import { PageContext, AIRecommendation } from '../types.js';

export class AnthropicClient extends AIClient {
  async call(context: PageContext): Promise<AIRecommendation> {
    const prompt = this.buildPrompt(context);

    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens ?? 300,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text?.trim() || '';
    
    return this.parseRecommendation(content, context);
  }
}


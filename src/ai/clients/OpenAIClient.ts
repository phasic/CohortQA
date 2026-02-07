import { AIClient, AIClientConfig } from '../AIClient.js';
import { PageContext, AIRecommendation } from '../types.js';

export class OpenAIClient extends AIClient {
  async call(context: PageContext): Promise<AIRecommendation> {
    const prompt = this.buildPrompt(context);

    // Add timeout for faster failure detection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      // Use prompt as system message (includes personality injection if provided)
      // Add a simple user message to trigger the response
      const messages = [
        {
          role: 'system',
          content: prompt // Prompt includes personality injection and all context
        },
        {
          role: 'user',
          content: 'Please analyze the elements and respond with JSON.'
        }
      ];

      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: this.config.temperature ?? 0.2,
          max_tokens: this.config.maxTokens ?? 150
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim() || '';
      
      return this.parseRecommendation(content, context);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('OpenAI request timed out after 15 seconds');
      }
      throw error;
    }
  }
}


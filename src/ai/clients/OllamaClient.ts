import { AIClient, AIClientConfig } from '../AIClient.js';
import { PageContext, AIRecommendation } from '../types.js';

export class OllamaClient extends AIClient {
  async call(context: PageContext): Promise<AIRecommendation> {
    const prompt = this.buildPrompt(context);

    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false,
        options: {
          temperature: this.config.temperature ?? 0.3
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      
      // Provide helpful error messages
      if (response.status === 0 || errorText.includes('ECONNREFUSED') || errorText.includes('fetch failed')) {
        throw new Error(`Ollama server is not running. Start it with: ollama serve`);
      }
      
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Ollama returns content in message.content
    // Handle both streaming and non-streaming responses
    let content = '';
    if (data.message?.content) {
      content = data.message.content;
    } else if (data.response) {
      content = data.response;
    } else if (typeof data === 'string') {
      content = data;
    } else {
      // Try to extract from any text field
      content = JSON.stringify(data);
    }
    
    if (!content || content.trim().length === 0) {
      throw new Error(`Ollama returned empty response. Response: ${JSON.stringify(data).substring(0, 200)}`);
    }
    
    return this.parseRecommendation(content, context);
  }
}


import { AIClient, AIClientConfig } from '../AIClient.js';
import { PageContext, AIRecommendation } from '../types.js';

export class OllamaClient extends AIClient {
  async call(context: PageContext): Promise<AIRecommendation> {
    const prompt = this.buildPrompt(context);

    // Add timeout and reduce max tokens for faster responses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: prompt // Prompt includes personality injection and all context
            }
          ],
          stream: false,
          options: {
            temperature: this.config.temperature ?? 0.2,
            num_predict: 150 // Limit response length for faster generation
          }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

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
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Ollama request timed out after 10 seconds');
      }
      throw error;
    }
  }
}


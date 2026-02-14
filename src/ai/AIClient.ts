import { InteractableElement, AIResponse, Config } from '../types.js';

export class AIClient {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Sends interactable elements to AI and gets back which element to interact with
   */
  async selectElement(elements: InteractableElement[], visitedUrls: string[]): Promise<AIResponse> {
    console.log(`🤖 Sending ${elements.length} elements to AI model (${this.config.ai.model})...`);
    
    const prompt = this.buildPrompt(elements, visitedUrls);
    
    try {
      const response = await this.callAI(prompt);
      return this.parseResponse(response);
    } catch (error: any) {
      console.error(`❌ AI call failed: ${error.message}`);
      throw error;
    }
  }

  private buildPrompt(elements: InteractableElement[], visitedUrls: string[]): string {
    const elementsList = elements.map((el, idx) => {
      const info = [
        `Index: ${idx}`,
        `Tag: ${el.tag}`,
        el.type ? `Type: ${el.type}` : null,
        el.text ? `Text: "${el.text.substring(0, 100)}"` : null,
        el.href ? `URL: ${el.href}` : null,
        el.ariaLabel ? `Aria Label: ${el.ariaLabel}` : null,
        el.role ? `Role: ${el.role}` : null,
        el.selector ? `Selector: ${el.selector}` : null,
      ].filter(Boolean).join(', ');
      
      return `[${idx}] ${info}`;
    }).join('\n');

    const visitedUrlsList = visitedUrls.length > 0 
      ? `\n\nAlready visited URLs:\n${visitedUrls.map(url => `- ${url}`).join('\n')}`
      : '';

    return `${this.config.ai.prompt.system_message}

${this.config.ai.prompt.instructions}

Available interactive elements:
${elementsList}${visitedUrlsList}

Return your response as JSON with the following structure:
{
  "elementIndex": <number>,
  "action": "<click|type|select|hover|scroll>",
  "value": "<optional value for type actions>",
  "reasoning": "<brief explanation>"
}`;
  }

  private async callAI(prompt: string): Promise<string> {
    if (this.config.ai.provider === 'ollama') {
      return this.callOllama(prompt);
    }
    
    throw new Error(`Unsupported AI provider: ${this.config.ai.provider}`);
  }

  private async callOllama(prompt: string): Promise<string> {
    // Construct the API URL
    // base_url should be like "http://localhost:11434/api" or "http://localhost:11434"
    let baseUrl = this.config.ai.base_url.trim();
    if (!baseUrl.endsWith('/api')) {
      if (baseUrl.endsWith('/')) {
        baseUrl = `${baseUrl}api`;
      } else {
        baseUrl = `${baseUrl}/api`;
      }
    }
    
    const url = `${baseUrl}/generate`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.ai.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.ai.temperature,
          num_predict: this.config.ai.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as { response?: string };
    return data.response || '';
  }

  private parseResponse(response: string): AIResponse {
    // Extract JSON from response (handle markdown code blocks, etc.)
    let jsonStr = response.trim();
    
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    try {
      const parsed = JSON.parse(jsonStr) as AIResponse;
      
      // Validate response
      if (typeof parsed.elementIndex !== 'number') {
        throw new Error('AI response missing elementIndex');
      }
      
      if (!parsed.action) {
        throw new Error('AI response missing action');
      }
      
      return parsed;
    } catch (error: any) {
      throw new Error(`Failed to parse AI response: ${error.message}. Response: ${jsonStr.substring(0, 200)}`);
    }
  }
}


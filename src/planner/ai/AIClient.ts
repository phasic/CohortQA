import { InteractableElement, AIResponse, Config } from '../types.js';

export class AIClient {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Formats elapsed time for display
   */
  private formatTime(ms: number): string {
    const blue = '\x1b[34m';
    const reset = '\x1b[0m';
    const time = ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
    return `${blue}${time}${reset}`;
  }

  /**
   * Extracts path from URL for more compact display
   */
  private getPathFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url.length > 50 ? url.substring(0, 50) + '...' : url;
    }
  }

  /**
   * Sends interactable elements to AI and gets back which element to interact with
   */
  async selectElement(elements: InteractableElement[], visitedUrls: string[]): Promise<AIResponse> {
    // Limit elements sent to AI to reduce prompt size and speed up response
    const maxElements = this.config.ai.max_elements_in_prompt || 0;
    const elementsToSend = maxElements > 0 && elements.length > maxElements 
      ? elements.slice(0, maxElements)
      : elements;
    
    if (elementsToSend.length < elements.length) {
      console.log(`  🤖 Sending ${elementsToSend.length} of ${elements.length} elements to AI model (${this.config.ai.model})...`);
    } else {
      console.log(`  🤖 Sending ${elements.length} elements to AI model (${this.config.ai.model})...`);
    }
    const startTime = performance.now();
    
    const prompt = this.buildPrompt(elementsToSend, visitedUrls);
    
    try {
      const response = await this.callAI(prompt);
      const parsed = this.parseResponse(response);
      const elapsedTime = performance.now() - startTime;
      console.log(`    ✅ AI response received (${this.formatTime(elapsedTime)})`);
      return parsed;
    } catch (error: any) {
      const elapsedTime = performance.now() - startTime;
      console.error(`    ❌ AI call failed after ${this.formatTime(elapsedTime)}: ${error.message}`);
      throw error;
    }
  }

  private buildPrompt(elements: InteractableElement[], visitedUrls: string[]): string {
    // Optimize: Only include essential information, truncate text, remove verbose fields
    const elementsList = elements.map((el, idx) => {
      const info = [
        `[${idx}]`,
        el.tag,
        el.text ? `"${el.text.substring(0, 50)}"` : null, // Reduced from 100 to 50 chars
        el.href ? `→${this.getPathFromUrl(el.href)}` : null, // Show only path, not full URL
        el.ariaLabel ? `aria:${el.ariaLabel.substring(0, 30)}` : null,
        el.role ? `role:${el.role}` : null,
      ].filter(Boolean).join(' ');
      
      return info;
    }).join('\n');

    // Optimize: Only show last 5 visited URLs to reduce prompt size
    const recentUrls = visitedUrls.slice(-5);
    const visitedUrlsList = recentUrls.length > 0 
      ? `\n\nRecently visited (${visitedUrls.length} total):\n${recentUrls.map(url => `- ${this.getPathFromUrl(url)}`).join('\n')}`
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
    
    if (this.config.ai.provider === 'lmstudio') {
      return this.callLMStudio(prompt);
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

  private async callLMStudio(prompt: string): Promise<string> {
    // LM Studio uses OpenAI-compatible API format
    // base_url should be like "http://localhost:1234" or "http://localhost:1234/v1"
    let baseUrl = this.config.ai.base_url.trim();
    if (!baseUrl.endsWith('/v1')) {
      if (baseUrl.endsWith('/')) {
        baseUrl = `${baseUrl}v1`;
      } else {
        baseUrl = `${baseUrl}/v1`;
      }
    }
    
    const url = `${baseUrl}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.ai.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.ai.temperature,
        max_tokens: this.config.ai.max_tokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('LM Studio API returned empty response');
    }
    
    return content;
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

  /**
   * Identifies notable elements on a page using AI
   */
  async identifyNotableElements(pageElements: Array<{
    tag: string;
    text?: string;
    selector?: string;
    id?: string;
    href?: string;
    role?: string;
  }>, pageTitle: string, url: string): Promise<Array<{
    selector?: string;
    text?: string;
    tag?: string;
    id?: string;
    reason?: string;
  }>> {
    console.log(`  🤖 Identifying notable elements on page (${pageTitle})...`);
    const startTime = performance.now();
    
    // Limit elements sent to AI
    const maxElements = 30;
    const elementsToSend = pageElements.slice(0, maxElements);
    
    const elementsList = elementsToSend.map((el, idx) => {
      const info = [
        `[${idx}]`,
        el.tag,
        el.text ? `"${el.text.substring(0, 50)}"` : null,
        el.selector ? `selector:${el.selector}` : null,
        el.id ? `id:${el.id}` : null,
        el.href ? `href:${el.href}` : null,
      ].filter(Boolean).join(' ');
      return info;
    }).join('\n');

    const prompt = `You are analyzing a web page to identify notable elements that should be tracked in a test plan.

Page Title: "${pageTitle}"
URL: ${url}

Available elements on the page:
${elementsList}

Identify 3-8 notable elements that are important for verifying the page loaded correctly. Notable elements could be:
- Main headings or titles
- Key content sections
- Important buttons or CTAs
- Form fields or inputs
- Navigation elements
- Status indicators
- Error messages
- Success messages
- Key data points or metrics

IMPORTANT: Avoid selecting elements with random hash IDs (like "invoker-xxxxx" or IDs with long random alphanumeric strings). 
Prefer elements with:
- Semantic IDs (like "main-content", "navigation", "contact-form")
- Text content (for text-based locators)
- Stable selectors (class names, semantic tags)
- Avoid IDs that look randomly generated

Return a JSON array with objects containing:
- selector (if available, avoid random hash-based selectors)
- text (if available, preferred for stability)
- tag
- id (if available, avoid random hash IDs)
- reason (brief explanation why this element is notable)

Example response:
[
  {
    "selector": "h1.main-title",
    "text": "Welcome to Our Platform",
    "tag": "h1",
    "reason": "Main page heading"
  },
  {
    "selector": "button.cta-primary",
    "text": "Get Started",
    "tag": "button",
    "reason": "Primary call-to-action button"
  }
]

Return only the JSON array, no other text.`;

    try {
      const response = await this.callAI(prompt);
      
      // Parse response
      let jsonStr = response.trim();
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      let notableElements = JSON.parse(jsonStr) as Array<{
        selector?: string;
        text?: string;
        tag?: string;
        id?: string;
        reason?: string;
      }>;
      
      // Filter out elements with random hash IDs (unstable selectors)
      notableElements = notableElements.filter(el => {
        // Check ID field
        if (el.id && this.hasRandomHashId(el.id)) {
          return false;
        }
        
        // Check selector field (may contain #id format)
        if (el.selector) {
          // Extract ID from selector if it's in #id format
          const idMatch = el.selector.match(/^#([a-z0-9-]+)/i);
          if (idMatch && this.hasRandomHashId(idMatch[1])) {
            return false;
          }
          // Also check the full selector string
          if (this.hasRandomHashId(el.selector)) {
            return false;
          }
        }
        
        // Prefer elements with text (more stable)
        // If no text and only has random hash ID/selector, skip it
        if (!el.text) {
          const hasRandomId = el.id && this.hasRandomHashId(el.id);
          const hasRandomSelector = el.selector && (
            this.hasRandomHashId(el.selector) || 
            (el.selector.match(/^#([a-z0-9-]+)/i) && this.hasRandomHashId(el.selector.match(/^#([a-z0-9-]+)/i)![1]))
          );
          if (hasRandomId || hasRandomSelector) {
            return false;
          }
        }
        
        return true;
      });
      
      const elapsedTime = performance.now() - startTime;
      console.log(`    ✅ Identified ${notableElements.length} notable elements (${this.formatTime(elapsedTime)})`);
      return notableElements;
    } catch (error: any) {
      const elapsedTime = performance.now() - startTime;
      console.error(`    ⚠️  Failed to identify notable elements after ${this.formatTime(elapsedTime)}: ${error.message}`);
      // Return empty array on error
      return [];
    }
  }
  
  /**
   * Checks if a selector or ID contains a random hash pattern
   * Patterns like: invoker-xxxxx, id-xxxxx, or long alphanumeric strings
   */
  private hasRandomHashId(selectorOrId: string): boolean {
    if (!selectorOrId) return false;
    // Check for common random hash patterns
    const randomHashPatterns = [
      /^invoker-[a-z0-9]{6,}$/i,  // invoker- followed by 6+ random chars (e.g., invoker-a7jm11z7zz)
      /^[a-z]+-[a-z0-9]{8,}$/i,   // word-dash followed by 8+ random chars
      /-[a-z0-9]{10,}/i,           // dash followed by 10+ random chars anywhere
      /^[a-z0-9]{12,}$/i,          // pure alphanumeric 12+ chars (likely random)
    ];
    
    return randomHashPatterns.some(pattern => pattern.test(selectorOrId));
  }
}


/**
 * AI-powered test healer
 * Uses AI to intelligently fix broken tests by analyzing context and suggesting best selectors
 */

import { TestFailure, FixResult } from '../types.js';
import { AIClient, AIClientConfig } from '../../ai/AIClient.js';
import { ProviderFactory } from '../../ai/ProviderFactory.js';
import { AIProvider } from '../../ai/types.js';

export interface HealingContext {
  testContent: string;
  failure: TestFailure;
  testName: string;
  errorMessage: string;
  lineNumber?: number;
}

export class TestHealerAI {
  private client: AIClient | null = null;
  private provider: AIProvider | null = null;
  private enabled: boolean = false;
  constructor() {
    this.provider = ProviderFactory.detectHealerProvider();
    
    // If provider is 'heuristic', explicitly disable AI
    if (this.provider === 'heuristic') {
      this.enabled = false;
      this.client = null;
    } else {
      const config = ProviderFactory.getHealerClientConfig(this.provider);
      if (config) {
        this.client = ProviderFactory.createClient(this.provider);
        this.enabled = this.client !== null;
      }
    }
  }

  /**
   * Checks if AI is enabled and available
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Gets the current AI provider
   */
  getProvider(): AIProvider | null {
    return this.provider;
  }

  /**
   * Heals test code using AI, or returns null to fall back to heuristics
   */
  async heal(context: HealingContext): Promise<FixResult | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    try {
      const fixed = await this.healWithAI(context);
      return fixed;
    } catch (error: any) {
      console.warn(`  ⚠️  AI healing failed: ${error.message}`);
      console.warn(`  🔄 Falling back to heuristic healing...`);
      return null;
    }
  }

  /**
   * Heals test code using AI
   */
  private async healWithAI(context: HealingContext): Promise<FixResult> {
    if (!this.client) {
      throw new Error('AI client not available');
    }

    const prompt = this.buildPrompt(context);
    const response = await this.callAI(prompt);
    const fixed = this.parseAIResponse(response, context);
    
    return fixed;
  }

  /**
   * Builds the prompt for AI test healing
   */
  private buildPrompt(context: HealingContext): string {
    const { testContent, failure, testName, errorMessage, lineNumber } = context;
    
    // Extract the problematic line if available
    const lines = testContent.split('\n');
    const problematicLine = lineNumber && lineNumber <= lines.length 
      ? lines[lineNumber - 1] 
      : null;
    
    // Extract surrounding context (5 lines before and after)
    const contextStart = lineNumber ? Math.max(0, lineNumber - 6) : 0;
    const contextEnd = lineNumber ? Math.min(lines.length, lineNumber + 5) : lines.length;
    const contextLines = lines.slice(contextStart, contextEnd);
    const contextCode = contextLines.join('\n');
    
    const prompt = `You are a Playwright test healing expert. Fix the broken test code below.

Test Name: ${testName}
Error: ${errorMessage}
${lineNumber ? `Line: ${lineNumber}` : ''}

Test Code:
\`\`\`typescript
${testContent}
\`\`\`

${problematicLine ? `Problematic Line: ${problematicLine}` : ''}
${contextCode ? `Context around error:\n\`\`\`typescript\n${contextCode}\n\`\`\`` : ''}

Your task:
1. Analyze the error and identify the root cause
2. Fix the test code to resolve the error
3. Choose the BEST selector strategy that:
   - Is specific enough to avoid strict mode violations
   - Provides good test coverage
   - Is maintainable and readable
   - Matches the test's intent
4. Ensure the fixed code follows Playwright best practices:
   - Use getByRole with specific names when possible
   - Use .first() or .nth() only when necessary
   - Add proper wait conditions
   - Use appropriate timeouts
   - Maintain test readability

Priority for selector selection:
1. getByRole with specific, meaningful text/name
2. getByLabel for form inputs
3. getByPlaceholder for inputs without labels
4. getByTestId if test IDs are available
5. locator with specific CSS selectors as last resort

Return ONLY the complete fixed test code, no explanations. The code must be valid TypeScript and complete.

Fixed test code:`;

    return prompt;
  }

  /**
   * Calls the AI with the prompt
   */
  private async callAI(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('AI client not available');
    }

    // Create a custom client that accepts a string prompt
    const customClient = new CustomAIClient(this.client);
    return await customClient.call(prompt);
  }

  /**
   * Parses AI response and extracts fixed code
   */
  private parseAIResponse(response: string, context: HealingContext): FixResult {
    // Clean up the response
    let code = response.trim();
    
    // Remove markdown code blocks if present
    code = code.replace(/```typescript\s*/g, '').replace(/```ts\s*/g, '').replace(/```\s*/g, '');
    
    // Remove any leading/trailing explanation text
    // Find the first occurrence of import or test( or // spec:
    const importMatch = code.match(/(import\s+.*?from\s+['"]@playwright\/test['"])/);
    const specMatch = code.match(/(\/\/\s*spec:)/);
    const testMatch = code.match(/(test\s*\(['"])/);
    
    let startIndex = 0;
    if (specMatch) {
      startIndex = specMatch.index || 0;
    } else if (importMatch) {
      startIndex = importMatch.index || 0;
    } else if (testMatch) {
      startIndex = testMatch.index || 0;
    }
    
    code = code.substring(startIndex);
    
    // Validate that the code is complete
    if (!this.isCodeComplete(code)) {
      throw new Error('AI generated incomplete code - missing closing braces or incomplete test function');
    }
    
    // Compare with original to determine what was fixed
    const appliedFixes: string[] = [];
    if (code !== context.testContent) {
      appliedFixes.push('ai-healing');
      
      // Detect specific types of fixes
      if (context.failure.error.toLowerCase().includes('strict mode violation')) {
        appliedFixes.push('ai-selector-fix');
      }
      if (context.failure.error.toLowerCase().includes('timeout')) {
        appliedFixes.push('ai-timeout-fix');
      }
      if (context.failure.error.toLowerCase().includes('navigation')) {
        appliedFixes.push('ai-navigation-fix');
      }
      if (context.failure.error.toLowerCase().includes('expect') || context.failure.error.toLowerCase().includes('assertion')) {
        appliedFixes.push('ai-assertion-fix');
      }
    }
    
    return { fixed: code, appliedFixes };
  }

  /**
   * Validates that the generated code is complete
   */
  private isCodeComplete(code: string): boolean {
    // Check for basic structure
    if (!code.includes('test(')) {
      return false;
    }
    
    // Remove strings and comments for brace counting
    const withoutStrings = code
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/['"`](?:[^'"`\\]|\\.)*['"`]/g, ''); // Remove strings
    
    // Count opening and closing braces
    const openBraces = (withoutStrings.match(/\{/g) || []).length;
    const closeBraces = (withoutStrings.match(/\}/g) || []).length;
    
    // Should have matching braces (allow small difference for edge cases)
    if (Math.abs(openBraces - closeBraces) > 1) {
      return false;
    }
    
    // Check if test function appears to be closed
    const testPattern = /test\s*\([^)]*\)\s*async\s*\([^)]*\)\s*\{/;
    const testMatch = code.match(testPattern);
    if (testMatch) {
      const testStartIndex = testMatch.index || 0;
      const afterTest = code.substring(testStartIndex);
      
      // Count braces after the test declaration
      let braceCount = 0;
      let inString = false;
      let stringChar = '';
      
      for (let i = 0; i < afterTest.length; i++) {
        const char = afterTest[i];
        const prevChar = i > 0 ? afterTest[i - 1] : '';
        
        // Handle string detection
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = '';
          }
        }
        
        // Count braces only when not in string
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
      }
      
      // If brace count is not zero, the test function is not properly closed
      if (braceCount !== 0) {
        return false;
      }
    }
    
    return true;
  }
}

/**
 * Custom AI client wrapper that accepts string prompts
 */
class CustomAIClient {
  private baseClient: AIClient;

  constructor(baseClient: AIClient) {
    this.baseClient = baseClient;
  }

  async call(prompt: string): Promise<string> {
    const config = (this.baseClient as any).config as AIClientConfig;
    const provider = this.detectProvider(config);
    
    const response = await this.makeAPICall(provider, config, prompt);
    return response;
  }

  private detectProvider(config: AIClientConfig): 'openai' | 'anthropic' | 'ollama' {
    if (config.apiUrl.includes('openai.com')) return 'openai';
    if (config.apiUrl.includes('anthropic.com')) return 'anthropic';
    return 'ollama';
  }

  private async makeAPICall(
    provider: 'openai' | 'anthropic' | 'ollama',
    config: AIClientConfig,
    prompt: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      if (provider === 'openai') {
        const response = await fetch(config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: 'You are a Playwright test healing expert. Fix broken tests by choosing the best selectors and strategies.' },
              { role: 'user', content: prompt }
            ],
            temperature: config.temperature || 0.3,
            max_tokens: config.maxTokens || 4000,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenAI API error: ${response.status} ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
      } else if (provider === 'anthropic') {
        const response = await fetch(config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'user', content: prompt }
            ],
            system: 'You are a Playwright test healing expert. Fix broken tests by choosing the best selectors and strategies.',
            temperature: config.temperature || 0.3,
            max_tokens: config.maxTokens || 4000,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Anthropic API error: ${response.status} ${error}`);
        }

        const data = await response.json();
        return data.content[0]?.text || '';
      } else {
        // Ollama
        const response = await fetch(config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: 'You are a Playwright test healing expert. Fix broken tests by choosing the best selectors and strategies.' },
              { role: 'user', content: prompt }
            ],
            temperature: config.temperature || 0.3,
            num_predict: config.maxTokens || 4000,
            stream: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Ollama API error: ${response.status} ${error}`);
        }

        const data = await response.json();
        return data.message?.content || '';
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}


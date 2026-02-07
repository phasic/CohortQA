/**
 * AI-powered test code generator
 * Generates Playwright test code from test scenarios using AI, with heuristics fallback
 */

import { TestScenario } from '../generator.js';
import { AIClient, AIClientConfig } from '../ai/AIClient.js';
import { ProviderFactory } from '../ai/ProviderFactory.js';
import { AIProvider } from '../ai/types.js';

export interface TestGenerationContext {
  scenario: TestScenario;
  baseUrl: string;
  specPath: string;
  seedPath?: string;
  generatedDir: string;
}

export interface GeneratedTestCode {
  code: string;
  usedAI: boolean;
}

export class TestCodeGenerator {
  private client: AIClient | null = null;
  private provider: AIProvider | null = null;
  private enabled: boolean = false;
  constructor() {
    this.provider = ProviderFactory.detectGeneratorProvider();
    
    // If provider is 'heuristic', explicitly disable AI
    if (this.provider === 'heuristic') {
      this.enabled = false;
      this.client = null;
    } else {
      const config = ProviderFactory.getGeneratorClientConfig(this.provider);
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
   * Generates test code using AI, or falls back to heuristics
   */
  async generate(context: TestGenerationContext): Promise<GeneratedTestCode> {
    if (this.enabled && this.client) {
      try {
        const code = await this.generateWithAI(context);
        // Validate the code is complete before returning
        if (this.isCodeComplete(code)) {
          return { code, usedAI: true };
        } else {
          console.warn(`  ⚠️  AI generated incomplete code`);
          console.warn(`  🔄 Falling back to heuristic generation...`);
          // Fall through to heuristics
        }
      } catch (error: any) {
        console.warn(`  ⚠️  AI generation failed: ${error.message}`);
        console.warn(`  🔄 Falling back to heuristic generation...`);
        // Fall through to heuristics
      }
    }

    // Fallback to heuristics
    const code = await this.generateWithHeuristics(context);
    return { code, usedAI: false };
  }

  /**
   * Generates test code using AI
   */
  private async generateWithAI(context: TestGenerationContext): Promise<string> {
    if (!this.client) {
      throw new Error('AI client not available');
    }

    const prompt = this.buildPrompt(context);
    const response = await this.callAI(prompt);
    return this.parseAICode(response, context);
  }

  /**
   * Builds the prompt for AI test generation
   */
  private buildPrompt(context: TestGenerationContext): string {
    const { scenario, baseUrl, specPath, seedPath } = context;
    
    let prompt = `Generate a Playwright test file for the following test scenario.

Test Scenario:
Title: ${scenario.title}
Base URL: ${baseUrl}
Spec Path: ${specPath}
${seedPath ? `Seed Path: ${seedPath}` : ''}

Steps:
${scenario.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Expected Results:
${scenario.expectedResults.map((result, i) => `- ${result}`).join('\n')}

Requirements:
1. Use Playwright's test framework with \`test\` and \`expect\` from '@playwright/test'
2. Use the \`browser\` fixture and create a new context with cookie setup
3. Set cookiesOptin=true cookie via addInitScript before any page loads
4. For navigation: use \`waitUntil: 'domcontentloaded', timeout: 30000\` and then \`waitForLoadState('networkidle')\`
5. For clicks: use \`getByRole\` with proper selectors, add visibility checks with \`expect().toBeVisible()\`
6. For assertions: use \`toHaveTitle\` for page titles, \`toBeVisible\` for elements
7. Escape single quotes in strings (use \\' or double quotes)
8. Use unique variable names (link, link2, link3, etc.) to avoid redeclaration
9. Add appropriate wait times after actions
10. Close the context at the end

Generate ONLY the test code, no explanations. Start with the comment lines (// spec: and // seed: if applicable), then imports, then the test function.

Test code:`;

    return prompt;
  }

  /**
   * Calls the AI with the prompt
   */
  private async callAI(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('AI client not available');
    }

    // Create a custom client that accepts a string prompt instead of PageContext
    const customClient = new CustomAIClient(this.client);
    return await customClient.call(prompt);
  }

  /**
   * Parses AI response and extracts test code
   */
  private parseAICode(response: string, context: TestGenerationContext): string {
    // Clean up the response
    let code = response.trim();
    
    // Remove markdown code blocks if present
    code = code.replace(/```typescript\s*/g, '').replace(/```ts\s*/g, '').replace(/```\s*/g, '');
    
    // Remove any leading/trailing explanation text
    // Find the first occurrence of import or // spec: or test(
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
    
    // Ensure we have the required header comments
    if (!code.includes('// spec:')) {
      code = `// spec: ${context.specPath}\n${context.seedPath ? `// seed: ${context.seedPath}\n` : ''}${code}`;
    }
    
    // Ensure we have the import (only if not already present)
    if (!code.includes("import { test, expect }")) {
      // Find where to insert the import (before // spec: or at the start)
      const specIndex = code.indexOf('// spec:');
      if (specIndex >= 0) {
        code = code.substring(0, specIndex) + `import { test, expect } from '@playwright/test';\n\n` + code.substring(specIndex);
      } else {
        code = `import { test, expect } from '@playwright/test';\n\n${code}`;
      }
    }
    
    // Validate that the code is complete (has closing braces for test function)
    if (!this.isCodeComplete(code)) {
      throw new Error('AI generated incomplete code - missing closing braces or incomplete test function');
    }
    
    return code;
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
    // Look for test( and ensure there's a matching closing brace
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
    
    // Check that the code ends with a closing brace and semicolon (or at least a closing brace)
    const trimmed = code.trim();
    if (!trimmed.endsWith('}') && !trimmed.endsWith('});')) {
      // Might still be valid if there are comments after, but this is a warning sign
      // Let's be lenient here
    }
    
    return true;
  }

  /**
   * Generates test code using heuristics (fallback)
   */
  private async generateWithHeuristics(context: TestGenerationContext): Promise<string> {
    // Import the heuristic generator from the main Generator class
    const { Generator } = await import('../generator.js');
    const generator = new Generator();
    // Make sure the generator is initialized (but we don't need the browser for code generation)
    // We'll just use the generateTestCode method directly
    return await generator.generateTestCode(
      context.scenario,
      context.baseUrl,
      context.specPath,
      context.seedPath,
      context.generatedDir
    );
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
    // We need to make a direct API call since the base client expects PageContext
    // Let's use the underlying client's config to make a direct call
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
              { role: 'system', content: 'You are a Playwright test code generator. Generate only valid TypeScript test code.' },
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
            system: 'You are a Playwright test code generator. Generate only valid TypeScript test code.',
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
              { role: 'system', content: 'You are a Playwright test code generator. Generate only valid TypeScript test code.' },
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


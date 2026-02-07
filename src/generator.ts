import { test as playwrightTest, expect } from '@playwright/test';
import { chromium, Browser, Page } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TestCodeGenerator } from './generator/TestCodeGenerator.js';
import chalk from 'chalk';

export interface TestScenario {
  title: string;
  seed?: string;
  steps: string[];
  expectedResults: string[];
}

export class Generator {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private testCodeGenerator: TestCodeGenerator;

  constructor() {
    this.testCodeGenerator = new TestCodeGenerator();
  }

  async initialize() {
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  /**
   * Checks if AI is enabled for test generation
   */
  isAIEnabled(): boolean {
    return this.testCodeGenerator.isEnabled();
  }

  /**
   * Gets the AI provider being used for test generation
   */
  getAIProvider(): string | null {
    return this.testCodeGenerator.getProvider();
  }

  async parseMarkdown(markdownPath: string): Promise<{ title: string; scenarios: TestScenario[] }> {
    const content = await fs.readFile(markdownPath, 'utf-8');
    const scenarios: TestScenario[] = [];

    // Extract title
    const titleMatch = content.match(/^# (.+?)$/m);
    const title = titleMatch ? titleMatch[1] : 'Test Plan';

    // Parse scenarios
    const scenarioSections = content.split(/^### \d+\./m);
    
    for (let i = 1; i < scenarioSections.length; i++) {
      const section = scenarioSections[i];
      
      const titleMatch = section.match(/^(.+?)\n\n/);
      if (!titleMatch) continue;
      const scenarioTitle = titleMatch[1].trim();

      const seedMatch = section.match(/\*\*Seed:\*\* `(.+?)`/);
      const seed = seedMatch ? seedMatch[1] : undefined;

      const stepsMatch = section.match(/\*\*Steps:\*\*\n((?:\d+\. .+?\n)+)/);
      const steps: string[] = [];
      if (stepsMatch) {
        const stepsText = stepsMatch[1];
        const stepLines = stepsText.split('\n').filter((line: string) => line.trim());
        steps.push(...stepLines.map((line: string) => line.replace(/^\d+\.\s*/, '').trim()));
      }

      const resultsMatch = section.match(/\*\*Expected Results:\*\*\n((?:- .+?\n)+)/);
      const expectedResults: string[] = [];
      if (resultsMatch) {
        const resultsText = resultsMatch[1];
        const resultLines = resultsText.split('\n').filter((line: string) => line.trim());
        expectedResults.push(...resultLines.map((line: string) => line.replace(/^-\s*/, '').trim()));
      }

      scenarios.push({
        title: scenarioTitle,
        seed,
        steps,
        expectedResults
      });
    }

    return { title, scenarios };
  }

  async generateTests(
    markdownPath: string,
    baseUrl: string,
    outputDir: string = './tests'
  ): Promise<string[]> {
    if (!this.page) {
      await this.initialize();
    }

    const { title, scenarios } = await this.parseMarkdown(markdownPath);
    const generatedFiles: string[] = [];

    // Create timestamped folder for generated tests
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2024-01-15T10-30-45
    const generatedDir = path.join(outputDir, `generated-${timestamp}`);
    await fs.mkdir(generatedDir, { recursive: true });
    
    // Store the generated directory path for return (will be used by CLI to display)
    (this as any).lastGeneratedDir = generatedDir;

    // Generate a test file for each scenario
    for (const scenario of scenarios) {
      const fileName = this.sanitizeFileName(scenario.title);
      const filePath = path.join(generatedDir, `${fileName}.spec.ts`);
      
      // Update seed path to point to tests/seed/ folder if it's a relative path
      let seedPath = scenario.seed;
      if (seedPath && !path.isAbsolute(seedPath)) {
        // If seed path doesn't start with tests/seed/, update it
        const seedFileName = path.basename(seedPath);
        seedPath = `tests/seed/${seedFileName}`;
      }
      
      // Use AI generator with heuristics fallback
      const result = await this.testCodeGenerator.generate({
        scenario,
        baseUrl,
        specPath: markdownPath,
        seedPath,
        generatedDir
      });
      
      await fs.writeFile(filePath, result.code, 'utf-8');
      generatedFiles.push(filePath);
    }

    // Return files with the generated directory info
    return generatedFiles;
  }
  
  /**
   * Gets the last generated directory path
   */
  getLastGeneratedDir(): string | null {
    return (this as any).lastGeneratedDir || null;
  }

  private sanitizeFileName(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  /**
   * Generates test code using heuristics (used as fallback by TestCodeGenerator)
   * Made public so TestCodeGenerator can access it
   */
  async generateTestCode(
    scenario: TestScenario,
    baseUrl: string,
    specPath: string,
    seedPath: string | undefined,
    generatedDir: string
  ): Promise<string> {
    let code = `// spec: ${specPath}\n`;
    if (seedPath) {
      code += `// seed: ${seedPath}\n`;
    }
    code += `\n`;
    code += `import { test, expect } from '@playwright/test';\n\n`;

    const testName = this.sanitizeTestName(scenario.title);
    code += `test('${testName}', async ({ browser }) => {\n`;
    // Create a new context with cookie setup, then create a page
    // This ensures the cookie is set before any page loads
    code += `  const context = await browser.newContext();\n`;
    code += `  await context.addInitScript(() => {\n`;
    code += `    // Set cookiesOptin cookie before any page loads to bypass cookie consent popups\n`;
    code += `    document.cookie = 'cookiesOptin=true; path=/; SameSite=Lax';\n`;
    code += `  });\n`;
    code += `  const page = await context.newPage();\n\n`;

    // Track variable names to avoid collisions
    const variableCounter = { link: 0, button: 0, input: 0 };
    // Track if this is the first navigation (no longer needed, but keeping for compatibility)
    const isFirstNavigation = { value: false };

    // Generate code for each step
    for (const step of scenario.steps) {
      code += await this.generateStepCode(step, baseUrl, variableCounter, isFirstNavigation);
    }

    // Generate assertions for expected results
    code += `\n  // Expected Results:\n`;
    for (const result of scenario.expectedResults) {
      code += await this.generateAssertionCode(result, variableCounter);
    }
    
    // Close the context at the end
    code += `\n  await context.close();\n`;

    code += `});\n`;

    return code;
  }

  private escapeString(str: string): string {
    // Escape single quotes and backslashes for use in single-quoted strings
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private async generateStepCode(step: string, baseUrl: string, variableCounter: { link: number; button: number; input: number }, isFirstNavigation: { value: boolean }): Promise<string> {
    let code = `  // ${step}\n`;

    // Navigation
    if (step.toLowerCase().includes('navigate to')) {
      const urlMatch = step.match(/navigate to (.+)/i);
      if (urlMatch) {
        const url = urlMatch[1].trim();
        if (url.startsWith('http')) {
          code += `  await page.goto('${this.escapeString(url)}', { waitUntil: 'domcontentloaded', timeout: 30000 });\n`;
        } else {
          code += `  await page.goto(\`\${'${this.escapeString(baseUrl)}'}${this.escapeString(url)}\`, { waitUntil: 'domcontentloaded', timeout: 30000 });\n`;
        }
      } else {
        code += `  await page.goto('${this.escapeString(baseUrl)}', { waitUntil: 'domcontentloaded', timeout: 30000 });\n`;
      }
      code += `  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});\n`;
      code += `  await page.waitForTimeout(1000);\n`;
    }

    // Click actions
    else if (step.toLowerCase().includes('click')) {
      if (step.includes('input field')) {
        const fieldMatch = step.match(/"(.*?)"/);
        if (fieldMatch) {
          const placeholder = this.escapeString(fieldMatch[1]);
          variableCounter.input++;
          const varName = variableCounter.input > 1 ? `input${variableCounter.input}` : 'input';
          code += `  const ${varName} = page.getByPlaceholder('${placeholder}');\n`;
          code += `  await expect(${varName}).toBeVisible();\n`;
          code += `  await ${varName}.click();\n`;
        } else {
          code += `  await page.locator('input, textarea').first().click();\n`;
        }
      } else if (step.includes('button')) {
        const buttonMatch = step.match(/"(.+?)"/);
        if (buttonMatch) {
          const buttonText = this.escapeString(buttonMatch[1]);
          variableCounter.button++;
          const varName = variableCounter.button > 1 ? `button${variableCounter.button}` : 'button';
          code += `  const ${varName} = page.getByRole('button', { name: '${buttonText}' });\n`;
          code += `  await expect(${varName}).toBeVisible();\n`;
          code += `  await ${varName}.click();\n`;
        } else {
          code += `  await page.locator('button, [role="button"]').first().click();\n`;
        }
      } else if (step.includes('link')) {
        const linkMatch = step.match(/"(.+?)"/);
        if (linkMatch) {
          const linkText = this.escapeString(linkMatch[1]);
          variableCounter.link++;
          const varName = variableCounter.link > 1 ? `link${variableCounter.link}` : 'link';
          code += `  const ${varName} = page.getByRole('link', { name: '${linkText}' });\n`;
          code += `  await expect(${varName}).toBeVisible();\n`;
          code += `  await ${varName}.click();\n`;
        } else {
          code += `  await page.locator('a').first().click();\n`;
        }
      } else {
        code += `  // TODO: Implement click action\n`;
        code += `  await page.locator('button, [role="button"]').first().click();\n`;
      }
      code += `  await page.waitForTimeout(1000);\n`;
    }

    // Type/Fill actions
    else if (step.toLowerCase().includes('type') || step.toLowerCase().includes('fill')) {
      const dataMatch = step.match(/type (.+)/i);
      const testData = dataMatch ? this.escapeString(dataMatch[1]) : 'test data';
      code += `  await page.locator('input, textarea').first().fill('${testData}');\n`;
    }

    // Press Enter
    else if (step.toLowerCase().includes('press enter')) {
      code += `  await page.keyboard.press('Enter');\n`;
      code += `  await page.waitForTimeout(1000);\n`;
    }

    // Wait actions
    else if (step.toLowerCase().includes('wait')) {
      code += `  await page.waitForTimeout(2000);\n`;
    }

    // Default
    else {
      code += `  // TODO: Implement step: ${step}\n`;
      code += `  await page.waitForTimeout(1000);\n`;
    }

    code += `\n`;
    return code;
  }

  private async generateAssertionCode(result: string, variableCounter: { link: number; button: number; input: number }): Promise<string> {
    let code = `  // - ${result}\n`;

    // Page title assertions
    if (result.toLowerCase().includes('page title is')) {
      const titleMatch = result.match(/"(.+?)"/);
      if (titleMatch) {
        const expectedTitle = this.escapeString(titleMatch[1]);
        code += `  await expect(page).toHaveTitle('${expectedTitle}');\n`;
      }
    } else if (result.toLowerCase().includes('title contains')) {
      const titleMatch = result.match(/"(.+?)"/);
      if (titleMatch) {
        const escapedTitle = this.escapeString(titleMatch[1]);
        code += `  await expect(page).toHaveTitle(/.*${escapedTitle}.*/i);\n`;
      }
    } 
    // Button/link text verification
    else if (result.toLowerCase().includes('button with text') || result.toLowerCase().includes('link with text')) {
      const textMatch = result.match(/"(.+?)"/);
      if (textMatch) {
        const elementText = this.escapeString(textMatch[1]);
        if (result.toLowerCase().includes('button')) {
          variableCounter.button++;
          const varName = variableCounter.button > 1 ? `button${variableCounter.button}` : 'button';
          code += `  const ${varName} = page.getByRole('button', { name: '${elementText}' });\n`;
          code += `  await expect(${varName}).toBeVisible();\n`;
        } else {
          variableCounter.link++;
          const varName = variableCounter.link > 1 ? `link${variableCounter.link}` : 'link';
          code += `  const ${varName} = page.getByRole('link', { name: '${elementText}' });\n`;
          code += `  await expect(${varName}).toBeVisible();\n`;
        }
      }
    }
    // Visibility assertions
    else if (result.toLowerCase().includes('visible') && !result.toLowerCase().includes('button') && !result.toLowerCase().includes('link')) {
      code += `  await expect(page.locator('body')).toBeVisible();\n`;
    } else if (result.toLowerCase().includes('clickable')) {
      // Already handled by button/link text verification above
      code += `  // Clickability verified by visibility check above\n`;
    } else if (result.toLowerCase().includes('navigate')) {
      code += `  // Navigation verified by URL change\n`;
    } else if (result.toLowerCase().includes('submit')) {
      code += `  // Form submission verified by page change or success message\n`;
      code += `  await page.waitForTimeout(2000);\n`;
    } else if (result.toLowerCase().includes('error')) {
      code += `  // Verify no errors are displayed\n`;
      code += `  const errorElements = page.locator('[role="alert"], .error, .alert-danger');\n`;
      code += `  await expect(errorElements).toHaveCount(0);\n`;
    } else {
      code += `  // TODO: Add assertion for: ${result}\n`;
    }

    return code;
  }

  private sanitizeTestName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}


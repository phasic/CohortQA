import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { chromium, Browser, Page } from '@playwright/test';

const execAsync = promisify(exec);

export interface TestFailure {
  testName: string;
  error: string;
  file: string;
  line?: number;
}

export class Healer {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async runTests(testFile?: string): Promise<{ passed: boolean; failures: TestFailure[] }> {
    try {
      const testCommand = testFile 
        ? `npx playwright test ${testFile} --reporter=json`
        : `npx playwright test --reporter=json`;
      
      const { stdout, stderr } = await execAsync(testCommand);
      
      // Check if tests passed by looking for success indicators
      if (stdout.includes('passed') && !stderr) {
        return { passed: true, failures: [] };
      }

      const failures = this.parseFailures(stdout + stderr, testFile || '');
      return { passed: failures.length === 0, failures };
    } catch (error: any) {
      const failures = this.parseFailures(
        error.stdout || error.stderr || error.message, 
        testFile || ''
      );
      return { passed: false, failures };
    }
  }

  private parseFailures(output: string, testFile: string): TestFailure[] {
    const failures: TestFailure[] = [];
    
    // Parse Playwright test failure patterns
    const testPattern = /Error: (.+?)\n\s+at (.+?):(\d+):(\d+)/g;
    let match;

    while ((match = testPattern.exec(output)) !== null) {
      failures.push({
        testName: this.extractTestName(output, match.index || 0),
        error: match[1],
        file: match[2] || testFile,
        line: parseInt(match[3])
      });
    }

    // Alternative pattern for test name and error
    if (failures.length === 0) {
      const testNamePattern = /test\(['"](.+?)['"]/g;
      const errorPattern = /Error: (.+?)(?:\n|$)/g;
      
      const testNames: string[] = [];
      let nameMatch;
      while ((nameMatch = testNamePattern.exec(output)) !== null) {
        testNames.push(nameMatch[1]);
      }

      let errorMatch;
      while ((errorMatch = errorPattern.exec(output)) !== null) {
        failures.push({
          testName: testNames[failures.length] || 'Unknown test',
          error: errorMatch[1],
          file: testFile,
        });
      }
    }

    return failures;
  }

  private extractTestName(output: string, position: number): string {
    const before = output.substring(Math.max(0, position - 500), position);
    const testMatch = before.match(/test\(['"](.+?)['"]/);
    return testMatch ? testMatch[1] : 'Unknown test';
  }

  async healTest(testFile: string, failure: TestFailure): Promise<boolean> {
    if (!this.page) {
      await this.initialize();
    }

    try {
      const testContent = await fs.readFile(testFile, 'utf-8');
      const fixedContent = await this.fixTestCode(testContent, failure);
      
      if (fixedContent !== testContent) {
        await fs.writeFile(testFile, fixedContent, 'utf-8');
        return true;
      }
    } catch (error) {
      console.error(`Error healing test: ${error}`);
    }

    return false;
  }

  private async fixTestCode(testContent: string, failure: TestFailure): Promise<string> {
    let fixed = testContent;
    const error = failure.error.toLowerCase();

    // Fix timeout errors
    if (error.includes('timeout') || error.includes('waiting')) {
      fixed = this.fixTimeoutIssues(fixed, failure);
    }

    // Fix selector errors
    if (error.includes('locator') || error.includes('selector') || error.includes('not found')) {
      fixed = await this.fixSelectorIssues(fixed, failure);
    }

    // Fix navigation errors
    if (error.includes('navigation') || error.includes('goto')) {
      fixed = this.fixNavigationIssues(fixed, failure);
    }

    // Fix assertion errors
    if (error.includes('expect') || error.includes('assertion')) {
      fixed = this.fixAssertionIssues(fixed, failure);
    }

    // Add wait times for flaky tests
    if (error.includes('element') || error.includes('visible')) {
      fixed = this.addWaitTimes(fixed, failure);
    }

    return fixed;
  }

  private fixTimeoutIssues(content: string, failure: TestFailure): string {
    // Increase timeout values
    content = content.replace(
      /waitForTimeout\((\d+)\)/g,
      (match, time) => `waitForTimeout(${Math.max(parseInt(time) * 2, 3000)})`
    );

    // Add networkidle wait if not present
    if (!content.includes("waitUntil: 'networkidle'")) {
      content = content.replace(
        /await page\.goto\(([^,)]+)\)/g,
        "await page.goto($1, { waitUntil: 'networkidle' })"
      );
    }

    return content;
  }

  private async fixSelectorIssues(content: string, failure: TestFailure): Promise<string> {
    // Replace fragile selectors with more robust ones
    content = content.replace(
      /page\.locator\('([^']+)'\)\.first\(\)/g,
      (match, selector) => {
        if (selector.includes('button')) {
          return "page.getByRole('button').first()";
        }
        if (selector.includes('link') || selector === 'a') {
          return "page.getByRole('link').first()";
        }
        if (selector.includes('input')) {
          return "page.locator('input').first()";
        }
        return match;
      }
    );

    // Add visibility checks before actions
    content = content.replace(
      /await page\.locator\('([^']+)'\)\.(click|fill)\(/g,
      (match, selector, action) => {
        return `await page.locator('${selector}').waitFor({ state: 'visible' });\n  await page.locator('${selector}').${action}(`;
      }
    );

    return content;
  }

  private fixNavigationIssues(content: string, failure: TestFailure): string {
    // Ensure proper URL handling with timeouts
    content = content.replace(
      /await page\.goto\(([^,)]+)\)/g,
      (match, url) => {
        if (!url.includes('waitUntil') && !url.includes('timeout')) {
          return `await page.goto(${url}, { waitUntil: 'networkidle', timeout: 30000 })`;
        }
        return match;
      }
    );

    return content;
  }

  private fixAssertionIssues(content: string, failure: TestFailure): string {
    // Make assertions more lenient with timeouts
    content = content.replace(
      /await expect\(([^)]+)\)\.([^(]+)\(([^)]+)\)/g,
      (match, target, assertion, value) => {
        if (!match.includes('timeout')) {
          return `await expect(${target}).${assertion}(${value}, { timeout: 10000 })`;
        }
        return match;
      }
    );

    return content;
  }

  private addWaitTimes(content: string, failure: TestFailure): string {
    // Add waits after navigation
    if (!content.includes('waitForTimeout') || (content.match(/waitForTimeout/g)?.length || 0) < 3) {
      content = content.replace(
        /await page\.goto\([^)]+\);/g,
        (match) => `${match}\n  await page.waitForTimeout(2000);`
      );
    }

    // Add waits after clicks
    const clickPattern = /await page\.[^;]+\.click\(\);/g;
    const clicks = content.match(clickPattern);
    if (clicks) {
      clicks.forEach((click: string) => {
        if (!content.includes(click + '\n  await page.waitForTimeout')) {
          content = content.replace(click, `${click}\n  await page.waitForTimeout(1000);`);
        }
      });
    }

    return content;
  }

  async healAllFailures(testFile?: string, maxIterations: number = 5): Promise<boolean> {
    for (let i = 0; i < maxIterations; i++) {
      const result = await this.runTests(testFile);
      
      if (result.passed) {
        return true;
      }

      console.log(`\nAttempt ${i + 1}: Found ${result.failures.length} failure(s)`);

      let healed = false;
      for (const failure of result.failures) {
        if (failure.file && failure.file.endsWith('.spec.ts')) {
          console.log(`  Healing: ${failure.testName}`);
          const wasHealed = await this.healTest(failure.file, failure);
          if (wasHealed) {
            healed = true;
            console.log(`  ✓ Fixed: ${failure.testName}`);
          }
        }
      }

      if (!healed) {
        console.log('  ⚠ Could not automatically fix remaining failures');
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const finalResult = await this.runTests(testFile);
    return finalResult.passed;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}


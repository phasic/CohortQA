/**
 * Main Healer class that orchestrates test healing
 */

import { chromium, Browser, Page } from '@playwright/test';
import * as fs from 'fs/promises';
import { TestResult, TestFailure, HealResult } from './types.js';
import { TestRunner } from './runner/TestRunner.js';
import { TestCodeFixer } from './fixes/TestCodeFixer.js';
import { FileResolver } from './utils/FileResolver.js';
import { AnsiCodeStripper } from './utils/AnsiCodeStripper.js';

export class Healer {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    // Note: The healer doesn't actually use this browser instance
    // Tests are run via Playwright's test runner which creates its own browsers
    // This is kept for potential future use or debugging
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async runTests(testFile?: string): Promise<TestResult> {
    return TestRunner.runTests(testFile);
  }

  async healTest(testFile: string, failure: TestFailure): Promise<HealResult> {
    if (!this.page) {
      await this.initialize();
    }

    try {
      const testContent = await fs.readFile(testFile, 'utf-8');
      const { fixed, appliedFixes } = TestCodeFixer.fix(testContent, failure);

      if (fixed !== testContent) {
        await fs.writeFile(testFile, fixed, 'utf-8');
        return {
          healed: true,
          reason: `Applied fixes: ${appliedFixes.join(', ')}`
        };
      } else {
        return {
          healed: false,
          reason: `No applicable fixes found for error type: "${failure.error.substring(0, 100)}"`
        };
      }
    } catch (error: any) {
      return {
        healed: false,
        reason: `Error reading/writing test file: ${error.message}`
      };
    }
  }

  async healAllFailures(testFile?: string, maxIterations: number = 5): Promise<boolean> {
    for (let i = 0; i < maxIterations; i++) {
      const result = await this.runTests(testFile);

      if (result.passed) {
        return true;
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Attempt ${i + 1}/${maxIterations}: Found ${result.failures.length} failure(s)`);
      console.log('='.repeat(60));

      let healed = false;
      for (const failure of result.failures) {
        // Resolve test file paths
        const filesToTry = await FileResolver.resolveTestFile(failure);

        // Try to heal each file
        let fileHealed = false;
        for (const fileToHeal of filesToTry) {
          console.log(`\n📋 Test: ${failure.testName || 'Unknown'}`);
          console.log(`   File: ${fileToHeal}${failure.line ? `:${failure.line}` : ''}`);
          const cleanError = AnsiCodeStripper.strip(failure.error);
          console.log(`   Error: ${cleanError.substring(0, 200)}${cleanError.length > 200 ? '...' : ''}`);

          const healResult = await this.healTest(fileToHeal, failure);
          if (healResult.healed) {
            healed = true;
            fileHealed = true;
            console.log(`   ✅ Fixed: ${healResult.reason}`);
            break; // Stop after first successful fix
          } else {
            console.log(`   ❌ Could not fix: ${healResult.reason}`);
          }
        }

        if (filesToTry.length === 0) {
          console.log(`\n⚠️  Skipping: ${failure.testName || 'Unknown'}`);
          console.log(`   File: ${failure.file || 'unknown'} (could not find test file)`);
          const cleanError = AnsiCodeStripper.strip(failure.error);
          console.log(`   Error: ${cleanError.substring(0, 200)}${cleanError.length > 200 ? '...' : ''}`);
        }
      }

      if (!healed) {
        console.log(`\n${'='.repeat(60)}`);
        console.log('⚠️  Could not automatically fix remaining failures');
        console.log('\nRemaining failures:');
        for (const failure of result.failures) {
          console.log(`  • ${failure.testName}`);
          console.log(`    Error: ${failure.error.substring(0, 150)}${failure.error.length > 150 ? '...' : ''}`);
          console.log(`    File: ${failure.file}${failure.line ? `:${failure.line}` : ''}`);
        }
        console.log('='.repeat(60));
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const finalResult = await this.runTests(testFile);
    if (!finalResult.passed && finalResult.failures.length > 0) {
      console.log(`\n${'='.repeat(60)}`);
      console.log('Final test results:');
      console.log('='.repeat(60));
      for (const failure of finalResult.failures) {
        console.log(`\n❌ ${failure.testName}`);
        console.log(`   File: ${failure.file}${failure.line ? `:${failure.line}` : ''}`);
        console.log(`   Error: ${failure.error}`);
      }
    }

    return finalResult.passed;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Re-export types for convenience
export type { TestFailure, TestResult, HealResult } from './types.js';


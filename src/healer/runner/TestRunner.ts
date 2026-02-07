/**
 * Runs Playwright tests and captures results
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { TestResult, TestFailure } from '../types.js';
import { TestFailureParser } from '../parsing/TestFailureParser.js';
import { AnsiCodeStripper } from '../utils/AnsiCodeStripper.js';

const execAsync = promisify(exec);

export class TestRunner {
  /**
   * Runs tests and returns results
   */
  static async runTests(testFile?: string, headless: boolean = false): Promise<TestResult> {
    try {
      // Use local playwright binary
      // Playwright runs headless by default, use --headed to show browser
      const playwrightBin = './node_modules/.bin/playwright';
      const headlessFlag = headless ? '' : '--headed';
      const testCommand = testFile
        ? `${playwrightBin} test ${testFile} --reporter=json ${headlessFlag}`.trim()
        : `${playwrightBin} test --reporter=json ${headlessFlag}`.trim();

      const { stdout, stderr } = await execAsync(testCommand);

      // Try to parse JSON output first (more reliable)
      try {
        const jsonOutput = JSON.parse(stdout);
        if (this.isPassed(jsonOutput)) {
          return { passed: true, failures: [] };
        }

        // Parse failures from JSON
        const failures = TestFailureParser.parseJSON(jsonOutput, testFile || '');
        if (failures.length > 0) {
          return { passed: false, failures };
        }
      } catch (jsonError) {
        // JSON parsing failed, fall back to text parsing
      }

      // Check if tests passed by looking for success indicators
      if (stdout.includes('passed') && !stderr && !stdout.includes('failed')) {
        return { passed: true, failures: [] };
      }

      // Strip ANSI codes before parsing
      const cleanOutput = AnsiCodeStripper.strip(stdout + stderr);
      const failures = TestFailureParser.parseText(cleanOutput, testFile || '');
      return { passed: failures.length === 0, failures };
    } catch (error: any) {
      // Strip ANSI codes from error output before parsing
      const errorOutput = AnsiCodeStripper.strip(error.stdout || error.stderr || error.message || '');
      const failures = TestFailureParser.parseText(errorOutput, testFile || '');
      return { passed: false, failures };
    }
  }

  /**
   * Checks if JSON output indicates all tests passed
   */
  private static isPassed(jsonOutput: any): boolean {
    if (jsonOutput.status === 'passed') {
      return true;
    }

    if (jsonOutput.suites) {
      return jsonOutput.suites.every((s: any) =>
        s.specs?.every((spec: any) =>
          spec.tests?.every((t: any) =>
            t.results?.every((r: any) => r.status === 'passed')
          )
        )
      );
    }

    return false;
  }
}


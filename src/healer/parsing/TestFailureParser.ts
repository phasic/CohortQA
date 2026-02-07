/**
 * Parses test failures from Playwright test output
 */

import { TestFailure } from '../types.js';
import { AnsiCodeStripper } from '../utils/AnsiCodeStripper.js';

export class TestFailureParser {
  /**
   * Parses JSON output from Playwright
   */
  static parseJSON(jsonOutput: any, testFile: string): TestFailure[] {
    const failures: TestFailure[] = [];

    if (!jsonOutput.suites) return failures;

    for (const suite of jsonOutput.suites) {
      if (!suite.specs) continue;

      for (const spec of suite.specs) {
        if (!spec.tests) continue;

        for (const test of spec.tests) {
          if (!test.results) continue;

          for (const result of test.results) {
            if (result.status === 'failed' || result.status === 'timedOut') {
              const error = result.error || { message: 'Unknown error' };
              const file = spec.file || testFile;

              // Strip ANSI color codes from error message
              let errorMessage = '';
              if (typeof error === 'string') {
                errorMessage = AnsiCodeStripper.strip(error);
              } else if (error.message) {
                errorMessage = AnsiCodeStripper.strip(String(error.message));
              } else {
                errorMessage = AnsiCodeStripper.strip(JSON.stringify(error));
              }

              failures.push({
                testName: spec.title || test.title || 'Unknown test',
                error: errorMessage,
                file: file,
                line: error.location?.line || this.extractLineFromStack(error.stack)
              });
            }
          }
        }
      }
    }

    return failures;
  }

  /**
   * Parses text output from Playwright
   */
  static parseText(output: string, testFile: string): TestFailure[] {
    const failures: TestFailure[] = [];

    // Strip ANSI codes first
    const cleanOutput = AnsiCodeStripper.strip(output);

    // Pattern 1: Standard error with stack trace
    const testPattern = /Error: (.+?)\n\s+at (.+?):(\d+):(\d+)/g;
    let match;

    while ((match = testPattern.exec(cleanOutput)) !== null) {
      const errorMsg = match[1];
      let file = match[2] || testFile;
      file = file.trim();

      failures.push({
        testName: this.extractTestName(cleanOutput, match.index || 0),
        error: errorMsg,
        file: file,
        line: parseInt(match[3])
      });
    }

    // Pattern 2: Test failure with test name and error
    if (failures.length === 0) {
      const testHeaderPattern = /\[chromium\]\s*›\s*(.+?\.spec\.ts):(\d+):(\d+)\s*›\s*(.+?)(?:\n|$)/g;
      let headerMatch;
      const headerMatches: Array<{ file: string; line: number; testName: string; index: number }> = [];

      while ((headerMatch = testHeaderPattern.exec(cleanOutput)) !== null) {
        headerMatches.push({
          file: headerMatch[1],
          line: parseInt(headerMatch[2]),
          testName: headerMatch[4].trim(),
          index: headerMatch.index
        });
      }

      // For each test header, find the error message
      for (let i = 0; i < headerMatches.length; i++) {
        const header = headerMatches[i];
        const nextHeaderIndex = i < headerMatches.length - 1 ? headerMatches[i + 1].index : cleanOutput.length;
        const testSection = cleanOutput.substring(header.index, nextHeaderIndex);

        // Find error in this section
        const errorMatch = testSection.match(/Error:\s*(.+?)(?:\n\s+at|\n\n|$)/s);
        const error = errorMatch ? AnsiCodeStripper.strip(errorMatch[1].trim()) : 'Unknown error';

        failures.push({
          testName: header.testName,
          error: error,
          file: header.file,
          line: header.line
        });
      }
    }

    // Pattern 3: Fallback - extract test names and errors separately
    if (failures.length === 0) {
      const testNamePattern = /test\(['"](.+?)['"]/g;
      const errorPattern = /Error:\s*(.+?)(?:\n|$)/g;

      const testNames: string[] = [];
      let nameMatch;
      while ((nameMatch = testNamePattern.exec(cleanOutput)) !== null) {
        testNames.push(nameMatch[1]);
      }

      let errorMatch;
      while ((errorMatch = errorPattern.exec(cleanOutput)) !== null) {
        failures.push({
          testName: testNames[failures.length] || 'Unknown test',
          error: AnsiCodeStripper.strip(errorMatch[1].trim()),
          file: testFile,
        });
      }
    }

    return failures;
  }

  /**
   * Extracts test name from output around a given position
   */
  private static extractTestName(output: string, position: number): string {
    const before = output.substring(Math.max(0, position - 500), position);
    const testMatch = before.match(/test\(['"](.+?)['"]/);
    return testMatch ? testMatch[1] : 'Unknown test';
  }

  /**
   * Extracts line number from stack trace
   */
  private static extractLineFromStack(stack: string | undefined): number | undefined {
    if (!stack) return undefined;
    const match = stack.match(/:(\d+):(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }
}


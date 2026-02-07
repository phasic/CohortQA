/**
 * Fixes timeout-related issues in test code
 */

import { TestFailure, FixResult } from '../types.js';

export class TimeoutFixer {
  /**
   * Fixes timeout issues
   */
  static fix(content: string, failure: TestFailure): FixResult {
    let fixed = content;
    const appliedFixes: string[] = [];

    // Increase timeout values
    const before1 = fixed;
    fixed = fixed.replace(
      /waitForTimeout\((\d+)\)/g,
      (match, time) => `waitForTimeout(${Math.max(parseInt(time) * 2, 3000)})`
    );
    if (fixed !== before1) appliedFixes.push('increased-timeouts');

    // Add networkidle wait if not present
    const before2 = fixed;
    if (!fixed.includes("waitUntil: 'networkidle'")) {
      fixed = fixed.replace(
        /await page\.goto\(([^,)]+)\)/g,
        "await page.goto($1, { waitUntil: 'networkidle' })"
      );
    }
    if (fixed !== before2) appliedFixes.push('added-networkidle');

    return { fixed, appliedFixes };
  }
}


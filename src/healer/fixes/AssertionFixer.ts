/**
 * Fixes assertion-related issues in test code
 */

import { TestFailure, FixResult } from '../types.js';

export class AssertionFixer {
  /**
   * Fixes assertion issues
   */
  static fix(content: string, failure: TestFailure): FixResult {
    let fixed = content;
    const appliedFixes: string[] = [];

    // Make assertions more lenient with timeouts
    const before = fixed;
    fixed = fixed.replace(
      /await expect\(([^)]+)\)\.([^(]+)\(([^)]+)\)/g,
      (match, target, assertion, value) => {
        if (!match.includes('timeout')) {
          return `await expect(${target}).${assertion}(${value}, { timeout: 10000 })`;
        }
        return match;
      }
    );
    if (fixed !== before) appliedFixes.push('assertion-timeouts');

    return { fixed, appliedFixes };
  }
}


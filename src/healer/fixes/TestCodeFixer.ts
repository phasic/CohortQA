/**
 * Main test code fixer that orchestrates all fixers
 */

import { TestFailure, FixResult } from '../types.js';
import { SelectorFixer } from './SelectorFixer.js';
import { NavigationFixer } from './NavigationFixer.js';
import { TimeoutFixer } from './TimeoutFixer.js';
import { AssertionFixer } from './AssertionFixer.js';
import { WaitTimeFixer } from './WaitTimeFixer.js';

export class TestCodeFixer {
  /**
   * Fixes test code based on failure type
   */
  static fix(testContent: string, failure: TestFailure): FixResult {
    let fixed = testContent;
    const allAppliedFixes: string[] = [];
    const error = failure.error.toLowerCase();

    // Fix timeout errors
    if (error.includes('timeout') || error.includes('waiting')) {
      const result = TimeoutFixer.fix(fixed, failure);
      fixed = result.fixed;
      allAppliedFixes.push(...result.appliedFixes);
    }

    // Fix selector errors (including strict mode violations)
    const hasStrictMode = failure.error.includes('strict mode violation') ||
      failure.error.includes('resolved to') ||
      error.includes('strict mode violation') ||
      error.includes('resolved to');

    if (error.includes('locator') || error.includes('selector') || error.includes('not found') ||
      hasStrictMode || error.includes('getbyrole') || error.includes('getByRole')) {
      const result = SelectorFixer.fix(fixed, failure);
      fixed = result.fixed;
      allAppliedFixes.push(...result.appliedFixes);
    }

    // Fix navigation errors
    if (error.includes('navigation') || error.includes('goto') || error.includes('about:blank')) {
      const result = NavigationFixer.fix(fixed, failure);
      fixed = result.fixed;
      allAppliedFixes.push(...result.appliedFixes);
    }

    // Fix assertion errors
    if (error.includes('expect') || error.includes('assertion') || error.includes('tohavetitle') || error.includes('tobevisible')) {
      const result = AssertionFixer.fix(fixed, failure);
      fixed = result.fixed;
      allAppliedFixes.push(...result.appliedFixes);
    }

    // Add wait times for flaky tests
    if (error.includes('element') || error.includes('visible') || error.includes('clickable')) {
      const result = WaitTimeFixer.fix(fixed, failure);
      fixed = result.fixed;
      allAppliedFixes.push(...result.appliedFixes);
    }

    return { fixed, appliedFixes: allAppliedFixes };
  }
}


/**
 * Main test code fixer that orchestrates all fixers
 */

import { TestFailure, FixResult } from '../types.js';
import { SelectorFixer } from './SelectorFixer.js';
import { NavigationFixer } from './NavigationFixer.js';
import { TimeoutFixer } from './TimeoutFixer.js';
import { AssertionFixer } from './AssertionFixer.js';
import { WaitTimeFixer } from './WaitTimeFixer.js';
import { TestHealerAI } from '../ai/TestHealerAI.js';

export class TestCodeFixer {
  private static healerAI: TestHealerAI | null = null;

  /**
   * Gets or creates the AI healer instance
   */
  private static getHealerAI(): TestHealerAI {
    if (!this.healerAI) {
      this.healerAI = new TestHealerAI();
    }
    return this.healerAI;
  }

  /**
   * Fixes test code based on failure type, using AI if available, otherwise heuristics
   */
  static async fix(testContent: string, failure: TestFailure): Promise<FixResult> {
    // Try AI first if available
    const healerAI = this.getHealerAI();
    if (healerAI.isEnabled()) {
      try {
        const aiResult = await healerAI.heal({
          testContent,
          failure,
          testName: failure.testName || 'Unknown test',
          errorMessage: failure.error,
          lineNumber: failure.line
        });
        
        if (aiResult) {
          return aiResult;
        }
      } catch (error: any) {
        // Fall through to heuristics if AI fails
      }
    }
    
    // Fall back to heuristic-based fixing
    return this.fixWithHeuristics(testContent, failure);
  }

  /**
   * Fixes test code using heuristics (fallback)
   */
  private static fixWithHeuristics(testContent: string, failure: TestFailure): FixResult {
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


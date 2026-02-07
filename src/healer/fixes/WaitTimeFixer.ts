/**
 * Adds wait times to flaky tests
 */

import { TestFailure, FixResult } from '../types.js';

export class WaitTimeFixer {
  /**
   * Adds wait times for flaky tests
   */
  static fix(content: string, failure: TestFailure): FixResult {
    let fixed = content;
    const appliedFixes: string[] = [];

    // Add waits after navigation
    const before1 = fixed;
    if (!fixed.includes('waitForTimeout') || (fixed.match(/waitForTimeout/g)?.length || 0) < 3) {
      fixed = fixed.replace(
        /await page\.goto\([^)]+\);/g,
        (match) => `${match}\n  await page.waitForTimeout(2000);`
      );
    }
    if (fixed !== before1) appliedFixes.push('navigation-waits');

    // Add waits after clicks
    const before2 = fixed;
    const clickPattern = /await page\.[^;]+\.click\(\);/g;
    const clicks = fixed.match(clickPattern);
    if (clicks) {
      clicks.forEach((click: string) => {
        if (!fixed.includes(click + '\n  await page.waitForTimeout')) {
          fixed = fixed.replace(click, `${click}\n  await page.waitForTimeout(1000);`);
        }
      });
    }
    if (fixed !== before2) appliedFixes.push('click-waits');

    return { fixed, appliedFixes };
  }
}


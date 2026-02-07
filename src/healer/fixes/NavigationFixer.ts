/**
 * Fixes navigation-related issues in test code
 */

import { TestFailure, FixResult } from '../types.js';

export class NavigationFixer {
  /**
   * Fixes navigation issues (timeouts, networkidle, etc.)
   */
  static fix(content: string, failure: TestFailure): FixResult {
    let fixed = content;
    const appliedFixes: string[] = [];

    // Fix navigation issues: change networkidle to domcontentloaded + separate networkidle wait
    // This is more reliable and faster
    const before1 = fixed;
    fixed = fixed.replace(
      /await page\.goto\(([^,)]+),\s*\{\s*waitUntil:\s*['"]networkidle['"]\s*\}\)/g,
      (match, url) => {
        return `await page.goto(${url}, { waitUntil: 'domcontentloaded', timeout: 30000 });\n  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});`;
      }
    );
    if (fixed !== before1) appliedFixes.push('networkidle-to-domcontentloaded');

    // Ensure proper URL handling with timeouts for goto calls without options
    const before2 = fixed;
    fixed = fixed.replace(
      /await page\.goto\(([^,)]+)\)/g,
      (match, url) => {
        if (!url.includes('waitUntil') && !url.includes('timeout')) {
          return `await page.goto(${url}, { waitUntil: 'domcontentloaded', timeout: 30000 });\n  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});`;
        }
        return match;
      }
    );
    if (fixed !== before2) appliedFixes.push('goto-timeout');

    return { fixed, appliedFixes };
  }
}


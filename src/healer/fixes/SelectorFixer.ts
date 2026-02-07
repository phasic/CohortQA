/**
 * Fixes selector-related issues in test code
 */

import { TestFailure, FixResult } from '../types.js';

export class SelectorFixer {
  /**
   * Fixes selector issues including strict mode violations
   */
  static fix(content: string, failure: TestFailure): FixResult {
    let fixed = content;
    const appliedFixes: string[] = [];

    // ALWAYS fix the most common case: getByRole('link', { name: 'link' }) - this is always problematic
    const before1 = fixed;
    fixed = fixed.replace(
      /page\.getByRole\(['"]link['"],\s*\{\s*name:\s*['"]link['"]\s*\}\)/g,
      () => {
        return `page.getByRole('link').first()`;
      }
    );
    if (fixed !== before1) appliedFixes.push('generic-link-selector');

    // Fix const declarations with generic 'link' name
    const before2 = fixed;
    fixed = fixed.replace(
      /const\s+(\w+)\s*=\s*page\.getByRole\(['"]link['"],\s*\{\s*name:\s*['"]link['"]\s*\}\);/g,
      (match, varName) => {
        return `const ${varName} = page.getByRole('link').first();`;
      }
    );
    if (fixed !== before2) appliedFixes.push('generic-link-const');

    // Also fix link2, link3, etc.
    const before3 = fixed;
    fixed = fixed.replace(
      /const\s+(link\d*)\s*=\s*page\.getByRole\(['"]link['"],\s*\{\s*name:\s*['"]link['"]\s*\}\);/g,
      (match, varName) => {
        return `const ${varName} = page.getByRole('link').first();`;
      }
    );
    if (fixed !== before3) appliedFixes.push('generic-link-vars');

    // Fix button with generic 'button' name
    const before4 = fixed;
    fixed = fixed.replace(
      /page\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"]button['"]\s*\}\)/g,
      () => {
        return `page.getByRole('button').first()`;
      }
    );
    if (fixed !== before4) appliedFixes.push('generic-button-selector');

    fixed = fixed.replace(
      /const\s+(\w+)\s*=\s*page\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"]button['"]\s*\}\);/g,
      (match, varName) => {
        return `const ${varName} = page.getByRole('button').first();`;
      }
    );

    // Fix any getByRole calls that might have generic names causing strict mode violations
    const hasStrictMode = failure.error.includes('strict mode violation') ||
      failure.error.includes('resolved to') ||
      failure.error.toLowerCase().includes('strict mode violation');
    
    if (hasStrictMode) {
      const before5 = fixed;
      // Find the problematic getByRole call in the error - handle escaped quotes and newlines
      const cleanError = failure.error.replace(/\\n/g, '\n').replace(/\\u001b/g, '').replace(/\\u[0-9a-fA-F]{4}/g, '');
      const roleMatch = cleanError.match(/getByRole\(['"](link|button)['"],\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\}\)/);
      
      if (roleMatch) {
        const role = roleMatch[1];
        const name = roleMatch[2];
        // If the name is too generic (like 'link', 'button', etc.), replace with .first()
        const genericNames = ['link', 'button', 'input', 'element', 'click', 'submit'];
        if (genericNames.includes(name.toLowerCase())) {
          // Replace all instances of this specific pattern (both in const declarations and direct calls)
          const pattern1 = new RegExp(`page\\.getByRole\\(['"]${role}['"],\\s*\\{\\s*name:\\s*['"]${name}['"]\\s*\\}\\)`, 'g');
          fixed = fixed.replace(pattern1, `page.getByRole('${role}').first()`);

          // Also handle const declarations
          const pattern2 = new RegExp(`const\\s+(\\w+)\\s*=\\s*page\\.getByRole\\(['"]${role}['"],\\s*\\{\\s*name:\\s*['"]${name}['"]\\s*\\}\\);`, 'g');
          fixed = fixed.replace(pattern2, (match, varName) => {
            return `const ${varName} = page.getByRole('${role}').first();`;
          });
        }
      }
      if (fixed !== before5) appliedFixes.push('strict-mode-violation');
    }

    // Replace fragile selectors with more robust ones
    const before6 = fixed;
    fixed = fixed.replace(
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
    if (fixed !== before6) appliedFixes.push('fragile-selectors');

    // Add visibility checks before actions
    const before7 = fixed;
    fixed = fixed.replace(
      /await page\.locator\('([^']+)'\)\.(click|fill)\(/g,
      (match, selector, action) => {
        return `await page.locator('${selector}').waitFor({ state: 'visible' });\n  await page.locator('${selector}').${action}(`;
      }
    );
    if (fixed !== before7) appliedFixes.push('visibility-checks');

    return { fixed, appliedFixes };
  }
}


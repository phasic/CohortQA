import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ParsedTestPlan, ParsedTestStep } from './types.js';
import { Config } from '../planner/types.js';

export class PlaywrightGenerator {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }
  /**
   * Generates a Playwright test suite from a parsed test plan
   */
  generateTestSuite(testPlan: ParsedTestPlan, outputPath?: string, fileName?: string): string {
    const outputDir = outputPath ? join(process.cwd(), outputPath) : join(process.cwd(), 'tests');
    mkdirSync(outputDir, { recursive: true });
    
    const testFileName = fileName || 'generated.spec.ts';
    const testFilePath = join(outputDir, testFileName);
    const testCode = this.generateTestCode(testPlan);
    
    writeFileSync(testFilePath, testCode, 'utf-8');
    return testFilePath;
  }
  
  /**
   * Generates a filename from the start URL and timestamp
   */
  generateFileName(startUrl: string): string {
    try {
      const url = new URL(startUrl);
      // Extract domain (e.g., "www.ing.be" -> "www-ing-be")
      const domain = url.hostname.replace(/\./g, '-');
      
      // Generate timestamp (YYYYMMDD-HHMMSS)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${year}${month}${day}-${hours}${minutes}${seconds}`;
      
      return `${domain}-${timestamp}.spec.ts`;
    } catch (error) {
      // Fallback if URL parsing fails
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      return `test-${timestamp}.spec.ts`;
    }
  }
  
  /**
   * Generates the test code
   */
  private generateTestCode(testPlan: ParsedTestPlan): string {
    let code = `import { test, expect } from '@playwright/test';\n\n`;
    
    // Generate a describe block for each step
    testPlan.steps.forEach((step, index) => {
      const describeName = this.generateDescribeName(step);
      const testName = this.generateTestName(step);
      
      code += `test.describe('${describeName}', () => {\n`;
      code += `  test('${testName}', async ({ page, context }) => {\n`;
      
      // Set cookies before navigation (same approach as planner)
      if (this.config.browser.cookies && this.config.browser.cookies.length > 0) {
        code += this.generateCookieSetupCode(testPlan.startUrl);
      }
      
      code += `    // Navigate to start URL\n`;
      code += `    await page.goto('${testPlan.startUrl}', { waitUntil: 'domcontentloaded' });\n`;
      
      // Reload page after setting cookies (same as planner)
      if (this.config.browser.cookies && this.config.browser.cookies.length > 0) {
        code += `    // Reload page so it picks up cookies before popup scripts run\n`;
        code += `    await page.reload({ waitUntil: 'networkidle' });\n`;
      } else {
        code += `    await page.waitForLoadState('networkidle');\n`;
      }
      
      code += `    await expect(page).toHaveURL('${testPlan.startUrl}');\n\n`;
      
      // Execute all previous steps first
      for (let i = 0; i < index; i++) {
        code += this.generateActionCode(testPlan.steps[i], true);
      }
      
      // Execute current step
      code += this.generateActionCode(step, false);
      
      // Generate assertions for expected results
      code += this.generateAssertions(step);
      
      code += `  });\n`;
      code += `});\n\n`;
    });
    
    return code;
  }
  
  /**
   * Generates a descriptive name for the describe block
   */
  private generateDescribeName(step: ParsedTestStep): string {
    const action = step.action.charAt(0).toUpperCase() + step.action.slice(1);
    
    if (step.element) {
      if (step.element.text) {
        return `Step ${step.stepNumber}: ${action} on "${this.truncateText(step.element.text, 50)}"`;
      } else if (step.element.href) {
        const url = new URL(step.element.href);
        return `Step ${step.stepNumber}: ${action} on link to ${url.pathname}`;
      } else if (step.element.selector) {
        return `Step ${step.stepNumber}: ${action} on element with selector "${this.truncateText(step.element.selector, 40)}"`;
      } else if (step.element.id) {
        return `Step ${step.stepNumber}: ${action} on element with id "${step.element.id}"`;
      }
    }
    
    if (step.action === 'navigate') {
      return `Step ${step.stepNumber}: Navigate to ${step.urlAfter}`;
    }
    
    return `Step ${step.stepNumber}: ${action}`;
  }
  
  /**
   * Generates a descriptive name for the test block
   */
  private generateTestName(step: ParsedTestStep): string {
    if (step.expectedResults && step.expectedResults.url) {
      const url = new URL(step.expectedResults.url);
      return `should ${step.action} and verify navigation to ${url.pathname}`;
    }
    
    if (step.expectedResults && step.expectedResults.pageTitle) {
      return `should ${step.action} and verify page title "${this.truncateText(step.expectedResults.pageTitle, 40)}"`;
    }
    
    return `should ${step.action} and verify expected results`;
  }
  
  /**
   * Generates code for executing an action (without assertions)
   */
  private generateActionCode(step: ParsedTestStep, isPreviousStep: boolean): string {
    let code = '';
    
    if (isPreviousStep) {
      code += `    // Step ${step.stepNumber}: ${step.action.toUpperCase()}\n`;
    } else {
      code += `    // Execute step ${step.stepNumber}: ${step.action.toUpperCase()}\n`;
    }
    
    // Generate element locator
    if (step.element) {
      const { locatorCode, needsPageLocator } = this.generateLocator(step.element);
      
      // If needsPageLocator is true, it's a simple selector string that needs wrapping
      // If false, it's already a complete locator expression
      const locator = needsPageLocator ? `page.locator(${locatorCode})` : locatorCode;
      
      if (step.action === 'click') {
        // Wait for element to be visible and enabled, scroll into view, then click
        code += `    await ${locator}.waitFor({ state: 'visible' });\n`;
        code += `    await ${locator}.scrollIntoViewIfNeeded();\n`;
        code += `    await ${locator}.click();\n`;
      } else if (step.action === 'type' && step.value) {
        code += `    await ${locator}.fill('${this.escapeString(step.value)}');\n`;
      } else if (step.action === 'select' && step.value) {
        code += `    await ${locator}.selectOption('${this.escapeString(step.value)}');\n`;
      } else if (step.action === 'hover') {
        code += `    await ${locator}.hover();\n`;
      } else if (step.action === 'scroll') {
        code += `    await ${locator}.scrollIntoViewIfNeeded();\n`;
      }
      
      // Add wait if specified
      if (step.waitAfter) {
        code += `    await page.waitForTimeout(${step.waitAfter});\n`;
      }
    } else if (step.action === 'navigate') {
      code += `    await page.goto('${step.urlAfter}');\n`;
    }
    
    // Add wait after navigation
    if (step.navigated) {
      code += `    await page.waitForLoadState('networkidle');\n`;
    }
    
    code += `\n`;
    return code;
  }
  
  /**
   * Generates assertions for expected results
   */
  private generateAssertions(step: ParsedTestStep): string {
    let code = '';
    
    if (!step.expectedResults) {
      return code;
    }
    
    code += `    // Verify expected results\n`;
    
    if (step.expectedResults.url) {
      code += `    await expect(page).toHaveURL('${step.expectedResults.url}');\n`;
    }
    
    if (step.expectedResults.pageTitle) {
      code += `    await expect(page).toHaveTitle('${this.escapeString(step.expectedResults.pageTitle)}');\n`;
    }
    
    // Verify key elements
    if (step.expectedResults.keyElements && step.expectedResults.keyElements.length > 0) {
      code += `\n    // Verify key elements\n`;
      step.expectedResults.keyElements.forEach((keyEl) => {
        const locatorResult = this.generateElementLocator(keyEl);
        if (locatorResult) {
          const locatorCode = locatorResult.needsPageLocator 
            ? `page.locator(${locatorResult.locatorCode})`
            : locatorResult.locatorCode;
          code += `    await expect(${locatorCode}).toBeVisible();\n`;
          if (keyEl.text) {
            code += `    await expect(${locatorCode}).toContainText('${this.escapeString(keyEl.text)}');\n`;
          }
        }
      });
    }
    
    // Verify notable elements
    if (step.expectedResults.notableElements && step.expectedResults.notableElements.length > 0) {
      code += `\n    // Verify notable elements\n`;
      step.expectedResults.notableElements.forEach((notableEl) => {
        const locatorResult = this.generateElementLocator(notableEl);
        if (locatorResult) {
          const locatorCode = locatorResult.needsPageLocator 
            ? `page.locator(${locatorResult.locatorCode})`
            : locatorResult.locatorCode;
          code += `    await expect(${locatorCode}).toBeVisible();\n`;
          if (notableEl.text) {
            code += `    await expect(${locatorCode}).toContainText('${this.escapeString(notableEl.text)}');\n`;
          }
        }
      });
    }
    
    return code;
  }
  
  /**
   * Truncates text to a maximum length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Generates cookie setup code (same approach as BrowserController)
   */
  private generateCookieSetupCode(startUrl: string): string {
    if (!this.config.browser.cookies || this.config.browser.cookies.length === 0) {
      return '';
    }
    
    try {
      const urlObj = new URL(startUrl);
      const defaultDomain = urlObj.hostname;
      const defaultPath = '/';
      const defaultSecure = urlObj.protocol === 'https:';
      
      let code = `    // Set cookies before page loads (same approach as planner)\n`;
      
      // Generate cookie config objects for init script
      const cookieConfigs = this.config.browser.cookies.map(cookie => {
        return `      { name: '${this.escapeString(cookie.name)}', value: '${this.escapeString(cookie.value)}', domain: ${cookie.domain ? `'${this.escapeString(cookie.domain)}'` : 'undefined'}, path: ${cookie.path ? `'${this.escapeString(cookie.path)}'` : 'undefined'}, secure: ${cookie.secure !== undefined ? cookie.secure : 'undefined'}, sameSite: ${cookie.sameSite ? `'${cookie.sameSite}'` : 'undefined'} }`;
      }).join(',\n');
      
      // Inject cookie-setting script that runs before any page scripts
      code += `    await page.addInitScript(({ cookies, defaultDomain, defaultPath, defaultSecure }) => {\n`;
      code += `      cookies.forEach(cookieConfig => {\n`;
      code += `        const domain = cookieConfig.domain || defaultDomain;\n`;
      code += `        const path = cookieConfig.path || defaultPath;\n`;
      code += `        const secure = cookieConfig.secure ?? defaultSecure;\n`;
      code += `        const sameSite = cookieConfig.sameSite || 'Lax';\n`;
      code += `        let cookieString = \`\${cookieConfig.name}=\${cookieConfig.value}\`;\n`;
      code += `        if (path) cookieString += \`; path=\${path}\`;\n`;
      code += `        if (domain) cookieString += \`; domain=\${domain}\`;\n`;
      code += `        if (secure) cookieString += '; secure';\n`;
      code += `        if (sameSite) cookieString += \`; samesite=\${sameSite}\`;\n`;
      code += `        document.cookie = cookieString;\n`;
      code += `      });\n`;
      code += `    }, {\n`;
      code += `      cookies: [\n${cookieConfigs}\n      ],\n`;
      code += `      defaultDomain: '${this.escapeString(defaultDomain)}',\n`;
      code += `      defaultPath: '${this.escapeString(defaultPath)}',\n`;
      code += `      defaultSecure: ${defaultSecure}\n`;
      code += `    });\n\n`;
      
      // Also set cookies via Playwright API (for proper cookie management)
      const cookiesArray = this.config.browser.cookies.map(cookie => {
        const domain = cookie.domain || defaultDomain;
        const path = cookie.path || defaultPath;
        const secure = cookie.secure ?? defaultSecure;
        const sameSite = cookie.sameSite || 'Lax';
        const httpOnly = cookie.httpOnly ?? false;
        
        return `      {\n        name: '${this.escapeString(cookie.name)}',\n        value: '${this.escapeString(cookie.value)}',\n        domain: '${this.escapeString(domain)}',\n        path: '${this.escapeString(path)}',\n        secure: ${secure},\n        sameSite: '${sameSite}',\n        httpOnly: ${httpOnly}\n      }`;
      }).join(',\n');
      
      code += `    // Also set cookies via Playwright API (for proper cookie management)\n`;
      code += `    const cookies = [\n${cookiesArray}\n    ];\n`;
      code += `    await context.addCookies(cookies);\n\n`;
      
      return code;
    } catch (error) {
      // If URL parsing fails, return empty string
      return '';
    }
  }
  
  /**
   * Generates a Playwright locator string for an element
   * Prioritizes specificity to avoid strict mode violations
   * Returns both the locator code and whether it needs page.locator() wrapper
   */
  private generateLocator(element: ParsedTestStep['element']): { locatorCode: string; needsPageLocator: boolean } {
    if (!element) {
      return { locatorCode: `''`, needsPageLocator: true };
    }
    
    // Strategy 1: Use ID if available (most specific)
    if (element.id) {
      return { locatorCode: `'#${this.escapeString(element.id)}'`, needsPageLocator: true };
    }
    
    // Strategy 2: Use XPath if available (very specific, often unique)
    if (element.xpath) {
      return { locatorCode: `'xpath=${this.escapeString(element.xpath)}'`, needsPageLocator: true };
    }
    
    // Strategy 3: Combine selector + href + text (most specific combination - all three available)
    // Add .first() as safety net since even this combination can match multiple elements
    if (element.selector && element.href && element.text) {
      const selector = this.escapeString(element.selector);
      const escapedText = this.escapeString(element.text);
      // Use exact href match (not contains) for maximum specificity
      try {
        const url = new URL(element.href);
        const fullHref = url.pathname + url.search + url.hash;
        const escapedHref = this.escapeString(fullHref).replace(/'/g, "\\'").replace(/"/g, '\\"');
        // Combine selector + exact href + text filter + .first() for maximum specificity
        return { 
          locatorCode: `page.locator('${selector}[href="${escapedHref}"]').filter({ hasText: '${escapedText}' }).first()`, 
          needsPageLocator: false 
        };
      } catch {
        // If URL parsing fails, use full href
        const escapedHref = this.escapeString(element.href).replace(/'/g, "\\'").replace(/"/g, '\\"');
        return { 
          locatorCode: `page.locator('${selector}[href="${escapedHref}"]').filter({ hasText: '${escapedText}' }).first()`, 
          needsPageLocator: false 
        };
      }
    }
    
    // Strategy 4: Combine selector + href (exact match, not contains)
    if (element.selector && element.href) {
      const selector = this.escapeString(element.selector);
      // Use exact href match for maximum specificity (not contains)
      try {
        const url = new URL(element.href);
        const fullHref = url.pathname + url.search + url.hash;
        const escapedHref = this.escapeString(fullHref).replace(/'/g, "\\'").replace(/"/g, '\\"');
        // Use exact href match (not contains) to avoid matching subpaths
        return { 
          locatorCode: `'${selector}[href="${escapedHref}"]'`, 
          needsPageLocator: true 
        };
      } catch {
        // If URL parsing fails, use full href
        const escapedHref = this.escapeString(element.href).replace(/'/g, "\\'").replace(/"/g, '\\"');
        return { 
          locatorCode: `'${selector}[href="${escapedHref}"]'`, 
          needsPageLocator: true 
        };
      }
    }
    
    // Strategy 5: Combine selector + text for specificity (when href not available)
    if (element.selector && element.text) {
      const escapedText = this.escapeString(element.text);
      const selector = this.escapeString(element.selector);
      return { 
        locatorCode: `page.locator('${selector}').filter({ hasText: '${escapedText}' })`, 
        needsPageLocator: false 
      };
    }
    
    // Strategy 6: Use href with text filtering (when selector not available but both href and text are)
    if (element.href && element.text) {
      const escapedText = this.escapeString(element.text);
      // Use exact href match (not contains) for maximum specificity
      try {
        const url = new URL(element.href);
        const fullHref = url.pathname + url.search + url.hash;
        const escapedHref = this.escapeString(fullHref).replace(/'/g, "\\'").replace(/"/g, '\\"');
        // Use exact href match + text filter for maximum specificity
        return { 
          locatorCode: `page.locator('a[href="${escapedHref}"]').filter({ hasText: '${escapedText}' })`, 
          needsPageLocator: false 
        };
      } catch {
        const escapedHref = this.escapeString(element.href).replace(/'/g, "\\'").replace(/"/g, '\\"');
        return { 
          locatorCode: `page.locator('a[href="${escapedHref}"]').filter({ hasText: '${escapedText}' })`, 
          needsPageLocator: false 
        };
      }
    }
    
    // Strategy 7: Use href alone (exact match, not contains)
    if (element.href) {
      try {
        const url = new URL(element.href);
        const fullHref = url.pathname + url.search + url.hash;
        const escapedHref = this.escapeString(fullHref).replace(/'/g, "\\'").replace(/"/g, '\\"');
        // Use exact href match (not contains) to avoid matching subpaths
        return { locatorCode: `'a[href="${escapedHref}"]'`, needsPageLocator: true };
      } catch {
        const escapedHref = this.escapeString(element.href).replace(/'/g, "\\'").replace(/"/g, '\\"');
        return { locatorCode: `'a[href="${escapedHref}"]'`, needsPageLocator: true };
      }
    }
    
    // Strategy 8: Use text-based role locators with selector scoping (when selector available)
    if (element.text && element.selector) {
      const escapedText = this.escapeString(element.text);
      const selector = this.escapeString(element.selector);
      if (element.tag === 'button' || element.role === 'button') {
        // Scope the role locator to the selector
        return { 
          locatorCode: `page.locator('${selector}').getByRole('button', { name: '${escapedText}', exact: false })`, 
          needsPageLocator: false 
        };
      } else if (element.tag === 'a' || element.role === 'link') {
        // Scope the role locator to the selector
        return { 
          locatorCode: `page.locator('${selector}').getByRole('link', { name: '${escapedText}', exact: false })`, 
          needsPageLocator: false 
        };
      }
    }
    
    // Strategy 9: Use text-based role locators (Playwright's recommended approach, but may match multiple)
    if (element.text) {
      const escapedText = this.escapeString(element.text);
      if (element.tag === 'button' || element.role === 'button') {
        return { 
          locatorCode: `page.getByRole('button', { name: '${escapedText}', exact: false })`, 
          needsPageLocator: false 
        };
      } else if (element.tag === 'a' || element.role === 'link') {
        return { 
          locatorCode: `page.getByRole('link', { name: '${escapedText}', exact: false })`, 
          needsPageLocator: false 
        };
      } else {
        return { 
          locatorCode: `page.getByText('${escapedText}', { exact: false })`, 
          needsPageLocator: false 
        };
      }
    }
    
    // Strategy 10: Use aria-label (good for accessibility)
    if (element.ariaLabel) {
      return { 
        locatorCode: `page.getByLabel('${this.escapeString(element.ariaLabel)}')`, 
        needsPageLocator: false 
      };
    }
    
    // Strategy 11: Use selector alone (fallback, but may match multiple elements)
    if (element.selector) {
      // Add .first() to handle strict mode violations
      return { 
        locatorCode: `page.locator('${this.escapeString(element.selector)}').first()`, 
        needsPageLocator: false 
      };
    }
    
    // Strategy 12: Use role alone
    if (element.role) {
      return { 
        locatorCode: `page.getByRole('${this.escapeString(element.role)}')`, 
        needsPageLocator: false 
      };
    }
    
    return { locatorCode: `''`, needsPageLocator: true };
  }
  
  /**
   * Generates a locator for expected result elements
   */
  private generateElementLocator(element: {
    selector?: string;
    id?: string;
    tag?: string;
    text?: string;
  }): { locatorCode: string; needsPageLocator: boolean } | null {
    // Strategy 1: Use ID if available (most specific)
    if (element.id) {
      return { locatorCode: `'#${this.escapeString(element.id)}'`, needsPageLocator: true };
    }
    
    // Strategy 1b: Check if selector is an ID selector (starts with #)
    if (element.selector && element.selector.startsWith('#')) {
      const id = element.selector.substring(1);
      return { locatorCode: `'#${this.escapeString(id)}'`, needsPageLocator: true };
    }
    
    // Strategy 2: If selector is available, use it (more specific than text alone)
    // For selectors with href, convert absolute URLs to relative pathnames
    if (element.selector) {
      // Check if selector has href attribute with absolute URL
      const hrefMatch = element.selector.match(/\[href=(['"])(https?:\/\/[^'"]+)\1\]/);
      if (hrefMatch) {
        try {
          const url = new URL(hrefMatch[2]); // hrefMatch[2] is the URL, hrefMatch[1] is the quote
          const pathname = url.pathname;
          // Replace absolute URL with pathname in selector, preserving quote style
          const quote = hrefMatch[1]; // Get the quote character used (' or ")
          const escapedPath = this.escapeString(pathname).replace(/'/g, "\\'").replace(/"/g, '\\"');
          const updatedSelector = element.selector.replace(/\[href=(['"])(https?:\/\/[^'"]+)\1\]/, `[href=${quote}${escapedPath}${quote}]`);
          // If text is also available, add text filter for extra specificity
          if (element.text) {
            const escapedText = this.escapeString(element.text);
            return { 
              locatorCode: `page.locator('${this.escapeString(updatedSelector)}').filter({ hasText: '${escapedText}' })`, 
              needsPageLocator: false 
            };
          }
          return { locatorCode: `'${this.escapeString(updatedSelector)}'`, needsPageLocator: true };
        } catch {
          // If URL parsing fails, fall through
        }
      }
      
      // If selector has text available, combine for extra specificity
      if (element.text) {
        const escapedText = this.escapeString(element.text);
        // Remove href part if present (handle both single and double quotes)
        const baseSelector = element.selector.replace(/\[href=(['"])(https?:\/\/[^'"]+)\1\]/, '').replace(/\[href=(['"])[^'"]+\1\]/, '');
        return { 
          locatorCode: `page.locator('${this.escapeString(baseSelector)}').filter({ hasText: '${escapedText}' })`, 
          needsPageLocator: false 
        };
      }
      
      // Use selector as-is
      return { locatorCode: `'${this.escapeString(element.selector)}'`, needsPageLocator: true };
    }
    
    // Strategy 3: Prefer text-based locators when text is available (fallback when no selector)
    if (element.text) {
      const escapedText = this.escapeString(element.text);
      // Only treat as link if explicitly a link (tag is 'a' or selector contains 'a' or 'href')
      const isLink = element.tag === 'a';
      
      if (isLink) {
        // Use exact: true to avoid matching multiple links with similar text
        return { 
          locatorCode: `page.getByRole('link', { name: '${escapedText}', exact: true })`, 
          needsPageLocator: false 
        };
      }
      // For elements with just tag + text
      if (element.tag) {
        return { 
          locatorCode: `page.locator('${element.tag}').filter({ hasText: '${escapedText}' })`, 
          needsPageLocator: false 
        };
      }
    }
    
    // Strategy 3: If selector contains href with absolute URL, convert to relative pathname
    if (element.selector) {
      // Check if selector has href attribute with absolute URL
      const hrefMatch = element.selector.match(/\[href=(['"])(https?:\/\/[^'"]+)\1\]/);
      if (hrefMatch) {
        try {
          const url = new URL(hrefMatch[2]); // hrefMatch[2] is the URL, hrefMatch[1] is the quote
          const pathname = url.pathname;
          // Replace absolute URL with pathname in selector, preserving quote style
          const quote = hrefMatch[1]; // Get the quote character used (' or ")
          const escapedPath = this.escapeString(pathname).replace(/'/g, "\\'").replace(/"/g, '\\"');
          const updatedSelector = element.selector.replace(/\[href=(['"])(https?:\/\/[^'"]+)\1\]/, `[href=${quote}${escapedPath}${quote}]`);
          return { locatorCode: `'${this.escapeString(updatedSelector)}'`, needsPageLocator: true };
        } catch {
          // If URL parsing fails, fall through to regular selector
        }
      }
      
      // Use selector as-is
      return { locatorCode: `'${this.escapeString(element.selector)}'`, needsPageLocator: true };
    }
    
    // Strategy 4: Use tag alone (least specific)
    if (element.tag) {
      return { locatorCode: `'${element.tag}'`, needsPageLocator: true };
    }
    
    return null;
  }
  
  /**
   * Escapes special characters in strings for use in code
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}


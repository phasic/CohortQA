import { Page } from '@playwright/test';

/**
 * Utility for logging page state information for debugging
 */
export class PageStateLogger {
  /**
   * Logs detailed page state information
   */
  static async logPageState(page: Page): Promise<void> {
    try {
      const pageState = await page.evaluate(() => {
        // Check for shadow DOM elements
        const shadowElements: string[] = [];
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el) => {
          if (el.shadowRoot) {
            shadowElements.push(el.tagName.toLowerCase());
          }
        });

        return {
          bodyExists: !!document.body,
          bodyChildren: document.body?.children.length || 0,
          totalElements: document.querySelectorAll('*').length,
          links: document.querySelectorAll('a[href]').length,
          buttons: document.querySelectorAll('button, [role="button"]').length,
          readyState: document.readyState,
          hasIframes: document.querySelectorAll('iframe').length > 0,
          title: document.title,
          bodyText: document.body?.textContent?.substring(0, 100) || '',
          shadowRoots: shadowElements.length,
          shadowRootTags: shadowElements.slice(0, 5),
          // Check for common web component patterns
          customElements: Array.from(document.querySelectorAll('*'))
            .filter((el) => el.tagName.includes('-') || el.shadowRoot)
            .map((el) => el.tagName.toLowerCase())
            .slice(0, 10),
        };
      });

      console.log(
        `   📊 Page state: ${pageState.bodyChildren} body children, ${pageState.totalElements} total elements, ${pageState.links} links, ${pageState.buttons} buttons`
      );
      console.log(`   📄 Ready state: ${pageState.readyState}, Has iframes: ${pageState.hasIframes}`);
      console.log(`   📝 Title: ${pageState.title}`);
      console.log(`   📄 Body preview: ${pageState.bodyText}...`);
      if (pageState.shadowRoots > 0) {
        console.log(`   🔍 Found ${pageState.shadowRoots} shadow DOM elements: ${pageState.shadowRootTags.join(', ')}`);
      }
      if (pageState.customElements.length > 0) {
        console.log(`   🧩 Found custom elements: ${pageState.customElements.join(', ')}`);
      }
    } catch (evalError: any) {
      console.log(`   ❌ Failed to evaluate page state: ${evalError.message}`);
      console.log(`   ⚠️  This might indicate the page is not accessible or blocked`);
    }
  }
}


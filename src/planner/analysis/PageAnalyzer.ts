import { Page } from '@playwright/test';
import { PageInfo } from '../types.js';

/**
 * Analyzes a page and extracts information about its structure
 */
export class PageAnalyzer {
  /**
   * Analyzes a page and returns structured information
   * Note: Assumes page is already loaded and ready (use PageLoader first)
   */
  static async analyzePage(page: Page): Promise<PageInfo> {
    // Verify we can evaluate the page (safety check only)
    try {
      const canEvaluate = await page.evaluate(() => {
        return {
          bodyExists: !!document.body,
          readyState: document.readyState
        };
      });
      
      if (!canEvaluate.bodyExists) {
        console.log(`   ⚠️  PageAnalyzer: Body does not exist yet`);
        // Return empty result if body doesn't exist
        return {
          title: '',
          url: page.url(),
          buttons: [],
          inputs: [],
          links: [],
          forms: [],
          headings: []
        };
      }
    } catch (err: any) {
      console.log(`   ❌ PageAnalyzer: Cannot evaluate page - ${err.message}`);
      // Return empty result
      return {
        title: '',
        url: page.url(),
        buttons: [],
        inputs: [],
        links: [],
        forms: [],
        headings: []
      };
    }
    
    return await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'))
        .map((el: Element) => {
          const element = el as HTMLElement;
          return {
            text: (element.textContent || '').trim() || element.getAttribute('aria-label') || '',
            selector: element.id ? `#${element.id}` :
              element.className && typeof element.className === 'string' ?
                `.${element.className.split(' ')[0]}` :
                element.tagName.toLowerCase()
          };
        });

      const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
        .map((el: Element) => {
          const element = el as HTMLInputElement;
          return {
            type: element.type || element.tagName.toLowerCase(),
            placeholder: element.placeholder || '',
            name: element.name || '',
            selector: element.id ? `#${element.id}` :
              element.name ? `[name="${element.name}"]` :
                element.tagName.toLowerCase()
          };
        });

      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((el: Element) => {
          const anchor = el as HTMLAnchorElement;
          return {
            text: (anchor.textContent || '').trim() || anchor.getAttribute('aria-label') || '',
            href: anchor.href,
            selector: anchor.id ? `#${anchor.id}` :
              anchor.className && typeof anchor.className === 'string' ?
                `.${anchor.className.split(' ')[0]}` :
                `a[href="${anchor.href}"]`
          };
        });

      const forms = Array.from(document.querySelectorAll('form'))
        .map((form: Element) => {
          const formEl = form as HTMLFormElement;
          return {
            action: formEl.action || '',
            method: formEl.method || 'get',
            inputs: Array.from(formEl.querySelectorAll('input, textarea, select')).length
          };
        });

      return {
        title: document.title,
        url: window.location.href,
        buttons,
        inputs,
        links,
        forms,
        headings: Array.from(document.querySelectorAll('h1, h2, h3'))
          .slice(0, 5)
          .map((h: Element) => h.textContent?.trim() || '')
      };
    });
  }
}


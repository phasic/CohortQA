import { Page } from '@playwright/test';
import { InteractiveElement } from '../../ai/types.js';
import { PLANNER_CONFIG } from '../config.js';

/**
 * Detects interactive elements on a page, including those in shadow DOM
 */
export class ElementDetector {
  /**
   * Finds all interactive elements on a page (buttons, links, inputs)
   * Excludes elements in configured ignored tags (header, nav, aside, footer, dbs-top-bar by default)
   */
  static async findInteractiveElements(page: Page, baseOrigin: string): Promise<InteractiveElement[]> {
    const ignoredTags = PLANNER_CONFIG.IGNORED_TAGS.join(', ');
    const elements: InteractiveElement[] = await page.evaluate((args: { baseOrigin: string; ignoredTags: string }) => {
      const { baseOrigin, ignoredTags } = args;
      const foundElements: Array<{
        type: string;
        text: string;
        href?: string;
        selector: string;
        isLink: boolean;
        tagName: string;
        index?: number;
        shadowPath?: string;
      }> = [];

      // Recursive function to traverse DOM including shadow roots
      function traverseDOM(root: Document | ShadowRoot | Element, shadowPath: string = ''): void {
        // Get all buttons in current root
        Array.from(root.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'))
          .forEach((el: Element, index: number) => {
            const element = el as HTMLElement;

            // Skip elements inside ignored tags
            const parent = element.closest(ignoredTags);
            if (parent !== null) {
              return;
            }

            const text = (element.textContent || '').trim() || element.getAttribute('aria-label') || '';
            const textLower = text.toLowerCase();

            // Skip only truly destructive actions
            const skip = textLower.includes('delete') &&
              textLower.includes('remove') &&
              textLower.includes('logout') &&
              textLower.includes('sign out');

            if (skip) {
              return;
            }

            // Check if element is visible
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const isVisible = style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              parseFloat(style.opacity) > 0 &&
              rect.width > 0 &&
              rect.height > 0 &&
              (element.offsetParent !== null ||
                element.closest('[role="dialog"], .modal, .dialog, [id*="cookie" i], [class*="cookie" i]') !== null ||
                rect.width > 0);

            if (!isVisible) {
              return;
            }

            // Build selector
            let selector = '';
            if (element.id) {
              selector = `#${element.id}`;
            } else if (element.className && typeof element.className === 'string') {
              const classes = element.className.split(' ').filter(c => c.length > 0);
              if (classes.length > 0) {
                selector = `.${classes[0]}`;
              }
            }

            if (!selector) {
              selector = `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
            }

            foundElements.push({
              type: 'button',
              text: text,
              selector: selector,
              isLink: false,
              tagName: element.tagName.toLowerCase(),
              index: index,
              shadowPath: shadowPath
            });
          });

        // Get ALL links in current root
        Array.from(root.querySelectorAll('a[href]'))
          .forEach((el: Element, index: number) => {
            const anchor = el as HTMLAnchorElement;

            // Skip elements inside header, nav, aside (sidebar), footer, or dbs-top-bar tags
            const parent = anchor.closest('header, nav, aside, footer, dbs-top-bar');
            if (parent !== null) {
              return;
            }

            try {
              const url = new URL(anchor.href);
              const isSameOrigin = url.origin === baseOrigin;
              const isAnchor = anchor.href.includes('#');

              if (!isSameOrigin || isAnchor) {
                return;
              }

              // Check if element is visible
              const style = window.getComputedStyle(anchor);
              const rect = anchor.getBoundingClientRect();

              const isVisible = style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                parseFloat(style.opacity) > 0 &&
                rect.width > 0 &&
                rect.height > 0 &&
                (rect.top < window.innerHeight + 1000 && rect.bottom > -1000) &&
                (anchor.offsetParent !== null ||
                  anchor.closest('[role="dialog"], .modal, .dialog, [id*="cookie" i], [class*="cookie" i]') !== null ||
                  rect.width > 0);

              if (!isVisible) {
                return;
              }

              let selector = '';
              if (anchor.id) {
                selector = `#${anchor.id}`;
              } else if (anchor.className && typeof anchor.className === 'string') {
                const classes = anchor.className.split(' ').filter(c => c.length > 0);
                if (classes.length > 0) {
                  selector = `.${classes[0]}`;
                }
              }

              if (!selector) {
                selector = `a[href="${anchor.href}"]`;
              }

              foundElements.push({
                type: 'link',
                text: (anchor.textContent || '').trim() || anchor.getAttribute('aria-label') || '',
                href: anchor.href,
                selector: selector,
                isLink: true,
                tagName: 'a',
                index: index,
                shadowPath: shadowPath
              });
            } catch {
              // Skip invalid links
            }
          });

        // Get ALL fillable inputs in current root
        Array.from(root.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], input[type="tel"], input[type="number"], textarea, select'))
          .forEach((el: Element, index: number) => {
            const element = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

            // Skip elements inside ignored tags
            const parent = element.closest(ignoredTags);
            if (parent !== null) {
              return;
            }

            if ((element as HTMLInputElement).readOnly ||
              (element as HTMLInputElement).disabled) {
              return;
            }

            // Check if element is visible
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const isVisible = style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              parseFloat(style.opacity) > 0 &&
              rect.width > 0 &&
              rect.height > 0 &&
              (element.offsetParent !== null ||
                element.closest('[role="dialog"], .modal, .dialog, [id*="cookie" i], [class*="cookie" i]') !== null ||
                rect.width > 0);

            if (!isVisible) {
              return;
            }

            const name = (element as HTMLInputElement).name || '';
            const nameLower = name.toLowerCase();

            // Skip password/secret fields
            if (nameLower.includes('password') || nameLower.includes('secret')) {
              return;
            }

            let selector = '';
            if (element.id) {
              selector = `#${element.id}`;
            } else if (name) {
              selector = `[name="${name}"]`;
            } else if (element.className && typeof element.className === 'string') {
              const classes = element.className.split(' ').filter(c => c.length > 0);
              if (classes.length > 0) {
                selector = `.${classes[0]}`;
              }
            }

            if (!selector) {
              selector = `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
            }

            foundElements.push({
              type: 'input',
              text: (element as HTMLInputElement).placeholder || name || '',
              selector: selector,
              isLink: false,
              tagName: element.tagName.toLowerCase(),
              index: index,
              shadowPath: shadowPath
            });
          });

        // Find all custom elements and web components that might have shadow roots
        const allElements = Array.from(root.querySelectorAll('*'));

        for (const el of allElements) {
          // Check if element has a shadow root
          if (el.shadowRoot) {
            const newShadowPath = shadowPath ? `${shadowPath} > ${el.tagName.toLowerCase()}` : el.tagName.toLowerCase();
            // Recursively traverse the shadow root
            traverseDOM(el.shadowRoot, newShadowPath);
          }
        }
      }

      // Start traversal from document root
      traverseDOM(document);

      return foundElements;
    }, { baseOrigin, ignoredTags });

    return elements as InteractiveElement[];
  }
}


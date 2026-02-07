import { Page } from '@playwright/test';
import { InteractiveElement } from '../../ai/types.js';
import { PLANNER_CONFIG } from '../config.js';

/**
 * Detects interactive elements on a page, including those in shadow DOM
 */
export class ElementDetector {
  /**
   * Finds all interactive elements on a page (buttons, links, inputs)
   * Excludes elements in configured ignored tags (header, aside, footer, dbs-top-bar by default)
   */
  static async findInteractiveElements(page: Page, baseOrigin: string): Promise<InteractiveElement[]> {
    const ignoredTags = PLANNER_CONFIG.IGNORED_TAGS.join(', ');
    
    // Wait for page to be ready
    console.log(`   ⏳ Waiting for page to be ready...`);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    
    // Wait for shadow DOM to be ready - try to find custom elements
    try {
      await page.waitForFunction(
        () => {
          const customElements = Array.from(document.querySelectorAll('*'));
          for (const el of customElements) {
            if (el.tagName && el.tagName.includes('-') && el.shadowRoot) {
              return true;
            }
          }
          return false;
        },
        { timeout: 10000 }
      ).catch(() => {});
    } catch {
      // Ignore if shadow DOM check times out
    }
    
    // Try to trigger lazy loading by scrolling
    try {
      await page.evaluate(() => {
        window.scrollTo(0, 100);
        setTimeout(() => window.scrollTo(0, 0), 100);
      });
    } catch {
      // Ignore scroll errors
    }
    
    await page.waitForTimeout(3000); // Increased wait for shadow DOM to render
    
    // Try waiting for any interactive elements to appear (including in shadow DOM)
    try {
      await Promise.race([
        page.waitForSelector('a[href]', { timeout: 5000 }).catch(() => {}),
        page.waitForSelector('button', { timeout: 5000 }).catch(() => {}),
        page.waitForSelector('[role="button"]', { timeout: 5000 }).catch(() => {}),
        page.waitForSelector('[role="link"]', { timeout: 5000 }).catch(() => {}),
        // Also try to find custom elements that might have shadow DOM
        page.waitForSelector('experience-renderer', { timeout: 5000 }).catch(() => {}),
        page.waitForTimeout(5000)
      ]);
    } catch {
      // Ignore
    }
    
    // First, do a simple test to see if page evaluation works at all
    // Also try using Playwright's locator API as a fallback
    let testResult: any = null;
    try {
      testResult = await page.evaluate(() => {
        return {
          bodyExists: !!document.body,
          bodyChildren: document.body?.children.length || 0,
          totalLinks: document.querySelectorAll('a[href]').length,
          totalButtons: document.querySelectorAll('button, [role="button"]').length,
          readyState: document.readyState,
          url: window.location.href,
          // Also check what's actually in the body
          bodyHTML: document.body?.innerHTML?.substring(0, 500) || '',
          firstChildTag: document.body?.firstElementChild?.tagName || ''
        };
      });
    } catch (err: any) {
      console.log(`   ❌ Page evaluation failed: ${err.message}`);
      console.log(`   🔍 Trying Playwright locator API instead...`);
      
      // Try using Playwright's locator API as fallback
      try {
        const linkCount = await page.locator('a[href]').count();
        const buttonCount = await page.locator('button, [role="button"]').count();
        testResult = {
          bodyExists: true,
          bodyChildren: 0,
          totalLinks: linkCount,
          totalButtons: buttonCount,
          readyState: 'complete',
          url: page.url(),
          bodyHTML: '',
          firstChildTag: ''
        };
        console.log(`   ✅ Playwright locator found: ${linkCount} links, ${buttonCount} buttons`);
      } catch (locatorErr: any) {
        console.log(`   ❌ Playwright locator also failed: ${locatorErr.message}`);
        return [];
      }
    }
    
    if (!testResult) {
      console.log(`   ❌ Cannot evaluate page - page might not be ready`);
      return [];
    }
    
    console.log(`   📊 Page check: ${testResult.bodyChildren} body children, ${testResult.totalLinks} links, ${testResult.totalButtons} buttons, ready: ${testResult.readyState}`);
    if (testResult.firstChildTag) {
      console.log(`   📄 First child tag: ${testResult.firstChildTag}`);
    }
    if (testResult.bodyHTML) {
      console.log(`   📝 Body HTML preview: ${testResult.bodyHTML.substring(0, 200)}...`);
    }
    
    // If evaluation found elements but they're 0, try using Playwright locators directly
    if (testResult.totalLinks === 0 && testResult.totalButtons === 0 && testResult.bodyChildren > 0) {
      console.log(`   🔍 Evaluation shows 0 elements but body has children - trying Playwright locators...`);
      try {
        const playLinks = await page.locator('a[href]').count();
        const playButtons = await page.locator('button, [role="button"], input[type="button"], input[type="submit"]').count();
        const playClickable = await page.locator('[role="button"], [role="link"], [onclick], [style*="cursor: pointer"]').count();
        console.log(`   📊 Playwright locators: ${playLinks} links, ${playButtons} buttons, ${playClickable} clickable elements`);
        
        if (playLinks > 0 || playButtons > 0 || playClickable > 0) {
          // Use Playwright locators to find elements
          return await this.findElementsWithLocators(page, baseOrigin);
        }
      } catch (locatorErr: any) {
        console.log(`   ⚠️  Playwright locator check failed: ${locatorErr.message}`);
      }
    }
    
    if (testResult.totalLinks === 0 && testResult.totalButtons === 0) {
      console.log(`   ⚠️  No elements found in DOM at all - page might not be loaded`);
      console.log(`   ⏳ Waiting longer for JavaScript to render content...`);
      
      // More aggressive waiting - wait for network idle and then some
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      } catch {
        // Ignore
      }
      
      // Wait for any custom elements to be defined
      try {
        await page.waitForFunction(
          () => {
            // Check if custom elements are defined
            return customElements !== undefined;
          },
          { timeout: 5000 }
        ).catch(() => {});
      } catch {
        // Ignore
      }
      
      // Wait additional time for JavaScript to render
      await page.waitForTimeout(5000);
      
      // Try scrolling to trigger lazy loading
      try {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
          setTimeout(() => window.scrollTo(0, 0), 200);
        });
        await page.waitForTimeout(1000);
      } catch {
        // Ignore
      }
      
      // Test again with more comprehensive check including shadow DOM
      const retryTest = await page.evaluate(() => {
        // Count elements including those in shadow DOM
        let links = document.querySelectorAll('a[href]').length;
        let buttons = document.querySelectorAll('button, [role="button"]').length;
        
        // Try to count in shadow DOM
        try {
          const allElements = Array.from(document.querySelectorAll('*'));
          for (const el of allElements) {
            if (el.shadowRoot) {
              const shadowLinks = el.shadowRoot.querySelectorAll('a[href]').length;
              const shadowButtons = el.shadowRoot.querySelectorAll('button, [role="button"]').length;
              links += shadowLinks;
              buttons += shadowButtons;
            }
          }
        } catch {
          // Shadow DOM might be closed
        }
        
        return {
          totalLinks: links,
          totalButtons: buttons,
        };
      }).catch(() => null);
      
      if (retryTest) {
        console.log(`   🔄 Retry check: ${retryTest.totalLinks} links, ${retryTest.totalButtons} buttons (including shadow DOM)`);
      }
    }
    
    // Use a more robust approach: try to pierce shadow DOM using Playwright's pierce option
    // First, let's try using Playwright's built-in shadow DOM support
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

      // Helper to safely get shadow root
      function getShadowRoot(element: Element): ShadowRoot | null {
        try {
          return element.shadowRoot;
        } catch {
          return null;
        }
      }

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

            // Skip elements inside header, aside (sidebar), footer, or dbs-top-bar tags
            const parent = anchor.closest('header, aside, footer, dbs-top-bar');
            if (parent !== null) {
              return;
            }

            try {
              // Skip JavaScript links and empty hrefs
              const href = anchor.href.trim();
              if (href === '' || href === '#' || href.startsWith('javascript:')) {
                return;
              }
              
              const url = new URL(anchor.href);
              const isSameOrigin = url.origin === baseOrigin;

              // Only skip if it's a different origin
              // Allow hash links (SPA routing) but prioritize full navigation links
              if (!isSameOrigin) {
                return;
              }
              
              // Skip if it's just a hash link to the same page (no path change)
              const isHashOnly = url.pathname === '' || url.pathname === '/';
              if (isHashOnly && !url.hash) {
                return; // Skip empty hash links
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
          const shadowRoot = getShadowRoot(el);
          
          if (shadowRoot) {
            const newShadowPath = shadowPath ? `${shadowPath} > ${el.tagName.toLowerCase()}` : el.tagName.toLowerCase();
            // Recursively traverse the shadow root
            try {
              traverseDOM(shadowRoot, newShadowPath);
            } catch (shadowError) {
              // If shadow DOM traversal fails, continue (might be closed shadow DOM)
            }
          }
          
          // Also check for elements with click handlers or cursor pointer that might be interactive
          // This helps catch JavaScript-rendered content
          const element = el as HTMLElement;
          const style = window.getComputedStyle(element);
          const hasPointer = style.cursor === 'pointer';
          const hasClickHandler = element.onclick !== null || element.getAttribute('onclick') !== null;
          const hasRole = element.getAttribute('role') === 'button' || element.getAttribute('role') === 'link';
          const isClickable = hasPointer || hasClickHandler || hasRole;
          
          // If it looks clickable but isn't a standard button/link, add it as a button
          if (isClickable && !element.closest(ignoredTags) && element.tagName.toLowerCase() !== 'button' && element.tagName.toLowerCase() !== 'a') {
            const rect = element.getBoundingClientRect();
            const isVisible = style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              parseFloat(style.opacity) > 0 &&
              rect.width > 0 &&
              rect.height > 0;
            
            if (isVisible && rect.top < window.innerHeight + 1000 && rect.bottom > -1000) {
              const text = (element.textContent || '').trim() || element.getAttribute('aria-label') || '';
              if (text.length > 0 && text.length < 100) {
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
                  const tagName = element.tagName.toLowerCase();
                  const siblings = Array.from(root.querySelectorAll(tagName));
                  selector = `${tagName}:nth-of-type(${siblings.indexOf(element) + 1})`;
                }
                
                foundElements.push({
                  type: 'button',
                  text: text,
                  selector: selector,
                  isLink: false,
                  tagName: element.tagName.toLowerCase(),
                  index: foundElements.length,
                  shadowPath: shadowPath
                });
              }
            }
          }
        }
      }

      // Start traversal from document root
      traverseDOM(document);
      
      // If no elements found, try a more aggressive approach - look for ANY clickable elements
      if (foundElements.length === 0) {
        console.log(`   🔍 No standard elements found, trying fallback detection...`);
        
        // Look for any elements that might be clickable
        const allClickable = Array.from(document.querySelectorAll('*')).filter((el: Element) => {
          const element = el as HTMLElement;
          if (element.closest(ignoredTags)) return false;
          
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          
          // Check if element is visible and potentially clickable
          const isVisible = style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            parseFloat(style.opacity) > 0 &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top < window.innerHeight + 1000 &&
            rect.bottom > -1000;
          
          if (!isVisible) return false;
          
          // Check for clickability indicators
          const hasPointer = style.cursor === 'pointer';
          const hasClick = element.onclick !== null || element.getAttribute('onclick') !== null;
          const hasRole = ['button', 'link', 'tab', 'menuitem'].includes(element.getAttribute('role') || '');
          const hasTabIndex = element.tabIndex >= 0;
          const hasHref = element.tagName === 'A' && (element as HTMLAnchorElement).href;
          
          return hasPointer || hasClick || hasRole || hasTabIndex || hasHref;
        });
        
        // Add these as potential buttons/links
        allClickable.slice(0, 20).forEach((el: Element, idx: number) => {
          const element = el as HTMLElement;
          const text = (element.textContent || '').trim() || element.getAttribute('aria-label') || '';
          if (text.length > 0 && text.length < 100) {
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
              selector = `${element.tagName.toLowerCase()}:nth-of-type(${idx + 1})`;
            }
            
            foundElements.push({
              type: element.tagName === 'A' ? 'link' : 'button',
              text: text,
              selector: selector,
              isLink: element.tagName === 'A',
              tagName: element.tagName.toLowerCase(),
              index: idx,
              href: element.tagName === 'A' ? (element as HTMLAnchorElement).href : undefined
            });
          }
        });
        
        console.log(`   ✅ Fallback detection found ${foundElements.length} potentially clickable elements`);
      }
      
      // Debug: Log shadow DOM traversal results
      const shadowElementsCount = foundElements.filter(el => el.shadowPath && el.shadowPath.length > 0).length;
      const totalElements = foundElements.length;
      
      // Also count shadow DOM roots found
      let shadowRootsFound = 0;
      try {
        const allEls = Array.from(document.querySelectorAll('*'));
        allEls.forEach((el) => {
          try {
            if (el.shadowRoot) shadowRootsFound++;
          } catch {
            // Closed shadow DOM
          }
        });
      } catch {
        // Ignore
      }
      
      if (shadowRootsFound > 0) {
        console.log(`   🔍 Found ${shadowRootsFound} shadow DOM root(s), ${shadowElementsCount} interactive elements inside shadow DOM`);
      }
      
      if (totalElements === 0 && shadowRootsFound > 0) {
        console.log(`   ⚠️  Shadow DOM detected but no elements found - shadow DOM might be closed or not fully rendered`);
      }

      return foundElements;
    }, { baseOrigin, ignoredTags });

    // Debug: Log what we found
    if (elements.length === 0) {
      console.log(`   ⚠️  ElementDetector found 0 elements. Checking page state...`);
      // Try to get some debug info
      const debugInfo = await page.evaluate(() => {
        return {
          totalLinks: document.querySelectorAll('a[href]').length,
          totalButtons: document.querySelectorAll('button, [role="button"]').length,
          totalInputs: document.querySelectorAll('input, textarea, select').length,
          bodyText: document.body?.textContent?.substring(0, 200) || '',
          readyState: document.readyState,
          ignoredTagsCount: {
            header: document.querySelectorAll('header').length,
            nav: document.querySelectorAll('nav').length,
            aside: document.querySelectorAll('aside').length,
            footer: document.querySelectorAll('footer').length,
            dbsTopBar: document.querySelectorAll('dbs-top-bar').length
          }
        };
      });
      console.log(`   📊 Page state: ${debugInfo.totalLinks} links, ${debugInfo.totalButtons} buttons, ${debugInfo.totalInputs} inputs in DOM`);
      console.log(`   📄 Ready state: ${debugInfo.readyState}`);
      console.log(`   🚫 Ignored tags: header=${debugInfo.ignoredTagsCount.header}, aside=${debugInfo.ignoredTagsCount.aside}, footer=${debugInfo.ignoredTagsCount.footer}, dbs-top-bar=${debugInfo.ignoredTagsCount.dbsTopBar}`);
      console.log(`   📝 Body preview: ${debugInfo.bodyText.substring(0, 100)}...`);
    }

    return elements as InteractiveElement[];
  }
  
  /**
   * Fallback method using Playwright locators when page.evaluate() doesn't work
   */
  private static async findElementsWithLocators(page: Page, baseOrigin: string): Promise<InteractiveElement[]> {
    const elements: InteractiveElement[] = [];
    const ignoredTags = PLANNER_CONFIG.IGNORED_TAGS;
    
    try {
      // Find links
      const links = await page.locator('a[href]').all();
      for (const link of links) {
        try {
          const href = await link.getAttribute('href');
          if (!href) continue;
          
          // Check if it's same origin
          try {
            const url = new URL(href, page.url());
            if (url.origin !== baseOrigin) continue;
          } catch {
            continue;
          }
          
          // Check if it's in ignored tags
          const inIgnored = await link.evaluate((el, ignored) => {
            return ignored.some((tag: string) => el.closest(tag) !== null);
          }, ignoredTags).catch(() => false);
          
          if (inIgnored) continue;
          
          // Check visibility
          const isVisible = await link.isVisible().catch(() => false);
          if (!isVisible) continue;
          
          const text = await link.textContent().catch(() => '') || '';
          const selector = await link.evaluate((el) => {
            if (el.id) return `#${el.id}`;
            if (el.className) return `.${el.className.split(' ')[0]}`;
            return 'a[href]';
          }).catch(() => 'a[href]');
          
          elements.push({
            type: 'link',
            text: text.trim(),
            href: href,
            selector: selector,
            isLink: true,
            tagName: 'a'
          });
        } catch {
          // Skip this link
        }
      }
      
      // Find buttons
      const buttons = await page.locator('button, [role="button"], input[type="button"], input[type="submit"]').all();
      for (const button of buttons) {
        try {
          // Check if it's in ignored tags
          const inIgnored = await button.evaluate((el, ignored) => {
            return ignored.some((tag: string) => el.closest(tag) !== null);
          }, ignoredTags).catch(() => false);
          
          if (inIgnored) continue;
          
          // Check visibility
          const isVisible = await button.isVisible().catch(() => false);
          if (!isVisible) continue;
          
          const text = await button.textContent().catch(() => '') || 
                       await button.getAttribute('aria-label').catch(() => '') || '';
          const selector = await button.evaluate((el) => {
            if (el.id) return `#${el.id}`;
            if (el.className) return `.${el.className.split(' ')[0]}`;
            return el.tagName.toLowerCase();
          }).catch(() => 'button');
          
          elements.push({
            type: 'button',
            text: text.trim(),
            selector: selector,
            isLink: false,
            tagName: 'button'
          });
        } catch {
          // Skip this button
        }
      }
      
      console.log(`   ✅ Found ${elements.length} elements using Playwright locators`);
    } catch (error: any) {
      console.log(`   ❌ Locator-based detection failed: ${error.message}`);
    }
    
    return elements;
  }
}


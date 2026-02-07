import { Page } from '@playwright/test';
import { InteractiveElement } from '../../ai/types.js';
import { UrlNormalizer } from '../utils/UrlNormalizer.js';
import { PLANNER_CONFIG } from '../config.js';

/**
 * Handles interactions with page elements (clicks, fills, etc.)
 */
export class InteractionHandler {
  /**
   * Verifies an element exists on the page using multiple methods
   */
  static async verifyElementExists(page: Page, element: InteractiveElement): Promise<boolean> {
    return await page.evaluate((args: { selector: string; text: string; isLink: boolean; href?: string; shadowPath?: string }) => {
      try {
        // Method 1: Try by href first (most reliable for links)
        if (args.isLink && args.href) {
          if (document.querySelector(`a[href="${args.href}"]`)) return true;
          const normalizedHref = args.href.split('#')[0].replace(/\/$/, '');
          const links = Array.from(document.querySelectorAll('a[href]'));
          for (const link of links) {
            const linkHref = (link as HTMLAnchorElement).href.split('#')[0].replace(/\/$/, '');
            if (linkHref === normalizedHref) return true;
          }
        }

        // Method 2: Try by text (case-insensitive, partial match)
        if (args.text && args.text.trim().length > 0) {
          const searchText = args.text.trim().toLowerCase();
          const allLinks = args.isLink ? Array.from(document.querySelectorAll('a')) : [];
          const allButtons = !args.isLink ? Array.from(document.querySelectorAll('button, [role="button"]')) : [];
          const allElements = [...allLinks, ...allButtons];

          for (const el of allElements) {
            const elText = (el.textContent || '').trim().toLowerCase();
            const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
            if (elText === searchText || elText.includes(searchText) || ariaLabel.includes(searchText)) {
              return true;
            }
          }
        }

        // Method 3: Try by selector
        if (args.selector && args.selector.length > 0 && !args.selector.includes('nth-of-type')) {
          try {
            if (document.querySelector(args.selector)) return true;
          } catch {
            // Invalid selector
          }
        }

        // Method 4: Try shadow DOM
        if (args.shadowPath) {
          const parts = args.shadowPath.split(' > ');
          let root: any = document;
          for (const part of parts) {
            const el = root.querySelector(part);
            if (el && el.shadowRoot) {
              root = el.shadowRoot;
            } else {
              return false;
            }
          }
          if (args.isLink && args.href) {
            if (root.querySelector(`a[href="${args.href}"]`)) return true;
            const normalizedHref = args.href.split('#')[0].replace(/\/$/, '');
            const links = Array.from(root.querySelectorAll('a[href]'));
            for (const link of links) {
              const linkHref = (link as HTMLAnchorElement).href.split('#')[0].replace(/\/$/, '');
              if (linkHref === normalizedHref) return true;
            }
          }
          if (root.querySelector(args.selector)) return true;
        }

        return false;
      } catch {
        return false;
      }
    }, {
      selector: element.selector,
      text: element.text || '',
      isLink: element.isLink,
      href: element.href,
      shadowPath: (element as any).shadowPath
    });
  }

  /**
   * Removes overlays and modals that might block clicks
   */
  private static async removeBlockingOverlays(page: Page): Promise<void> {
    await page.evaluate(() => {
      // Remove common overlays, modals, and popups
      const selectors = [
        '[class*="overlay" i]',
        '[class*="modal" i]',
        '[id*="cookie" i]',
        '[class*="cookie" i]',
        '[id*="consent" i]',
        '[class*="consent" i]',
        '[id*="gdpr" i]',
        '[class*="gdpr" i]',
        '[role="dialog"]',
        '.modal',
        '.dialog',
        '[class*="popup" i]',
        '[class*="backdrop" i]',
        '[class*="notification" i]',
        '[class*="banner" i]'
      ];

      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el: Element) => {
            const htmlEl = el as HTMLElement;
            // Hide instead of remove to avoid breaking page functionality
            htmlEl.style.display = 'none';
            htmlEl.style.visibility = 'hidden';
            htmlEl.style.opacity = '0';
            htmlEl.style.pointerEvents = 'none';
          });
        } catch {
          // Ignore selector errors
        }
      });

      // Also try to close any visible dialogs
      const dialogs = document.querySelectorAll('[role="dialog"], .modal, .dialog');
      dialogs.forEach((dialog: Element) => {
        const htmlDialog = dialog as HTMLElement;
        if (htmlDialog.style.display !== 'none') {
          // Try to find and click close buttons
          const closeButtons = dialog.querySelectorAll(
            'button[aria-label*="close" i], button:has-text("Close"), button:has-text("×"), button:has-text("✕"), [class*="close" i]'
          );
          if (closeButtons.length > 0) {
            (closeButtons[0] as HTMLElement).click();
          } else {
            // Hide the dialog
            htmlDialog.style.display = 'none';
            htmlDialog.style.visibility = 'hidden';
            htmlDialog.style.opacity = '0';
            htmlDialog.style.pointerEvents = 'none';
          }
        }
      });
    });
    await page.waitForTimeout(300);
  }

  /**
   * Clicks a link element with multiple fallback strategies
   */
  private static async clickLink(page: Page, element: InteractiveElement): Promise<boolean> {
    try {
      // Remove blocking overlays proactively
      await this.removeBlockingOverlays(page);

      // For links, wait for navigation (either full page or hash change)
      const navigationPromise = Promise.race([
        page.waitForLoadState('domcontentloaded', { timeout: PLANNER_CONFIG.NAVIGATION_WAIT_TIMEOUT }).catch(() => {}),
        page.waitForURL('**', { timeout: PLANNER_CONFIG.NAVIGATION_WAIT_TIMEOUT }).catch(() => {}),
        // Also wait for hash changes (SPA routing)
        page.waitForFunction(
          (initialHash) => window.location.hash !== initialHash,
          new URL(page.url()).hash,
          { timeout: 2000 }
        ).catch(() => {})
      ]);

      // Strategy 1: Try by href first (most reliable)
      if (element.href) {
        try {
          // Normalize href for matching
          const normalizedHref = element.href.split('#')[0].replace(/\/$/, '');
          const linkByHref = page.locator(`a[href*="${normalizedHref}"]`).first();
          
          await linkByHref.waitFor({ state: 'visible', timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT });
          await linkByHref.scrollIntoViewIfNeeded();
          
          // Check if clickable
          const isClickable = await linkByHref.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            return elementAtPoint === el || el.contains(elementAtPoint);
          });

          if (!isClickable) {
            await this.removeBlockingOverlays(page);
          }

          await linkByHref.click({ timeout: PLANNER_CONFIG.CLICK_TIMEOUT, force: false });
          await navigationPromise;
          await page.waitForTimeout(500);
          return true;
        } catch (hrefError) {
          // Try next strategy
        }
      }

      // Strategy 2: Try by text with getByRole (if text available)
      if (element.text && element.text.trim().length > 0) {
        try {
          const link = page.getByRole('link', { name: element.text.trim() });
          await link.waitFor({ state: 'visible', timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT });
          await link.scrollIntoViewIfNeeded();
          
          // Check if clickable
          const isClickable = await link.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            return elementAtPoint === el || el.contains(elementAtPoint);
          });

          if (!isClickable) {
            await this.removeBlockingOverlays(page);
          }

          await link.click({ timeout: PLANNER_CONFIG.CLICK_TIMEOUT, force: false });
          await navigationPromise;
          await page.waitForTimeout(500);
          return true;
        } catch (textError) {
          // Try with force click
          try {
            const link = page.getByRole('link', { name: element.text.trim() });
            await link.scrollIntoViewIfNeeded();
            await link.click({ timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT, force: true });
            await navigationPromise;
            await page.waitForTimeout(500);
            return true;
          } catch {
            // Try next strategy
          }
        }
      }

      // Strategy 3: Try shadow DOM (if shadowPath available)
      if ((element as any).shadowPath) {
        try {
          const clicked = await page.evaluate((args: { shadowPath: string; href: string }) => {
            const parts = args.shadowPath.split(' > ');
            let root: any = document;
            for (const part of parts) {
              const el = root.querySelector(part);
              if (el && el.shadowRoot) {
                root = el.shadowRoot;
              } else {
                return false;
              }
            }
            const link = root.querySelector(`a[href*="${args.href}"]`);
            if (link) {
              link.scrollIntoView({ behavior: 'smooth', block: 'center' });
              link.click();
              return true;
            }
            return false;
          }, { shadowPath: (element as any).shadowPath, href: element.href! });
          
          if (clicked) {
            await navigationPromise;
            await page.waitForTimeout(500);
            return true;
          }
        } catch {
          // Try next strategy
        }
      }

      // Strategy 4: Try by selector
      if (element.selector && element.selector.length > 0) {
        try {
          const linkLocator = page.locator(element.selector).first();
          await linkLocator.waitFor({ state: 'visible', timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT });
          await linkLocator.scrollIntoViewIfNeeded();
          
          // Check if clickable
          const isClickable = await linkLocator.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            return elementAtPoint === el || el.contains(elementAtPoint);
          });

          if (!isClickable) {
            await this.removeBlockingOverlays(page);
          }

          await linkLocator.click({ timeout: PLANNER_CONFIG.CLICK_TIMEOUT, force: false });
          await navigationPromise;
          await page.waitForTimeout(500);
          return true;
        } catch {
          // Try force click
          try {
            const linkLocator = page.locator(element.selector).first();
            await linkLocator.scrollIntoViewIfNeeded();
            await linkLocator.click({ timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT, force: true });
            await navigationPromise;
            await page.waitForTimeout(500);
            return true;
          } catch {
            // Try next strategy
          }
        }
      }

      // Strategy 5: Last resort - direct navigation (if href is available)
      if (element.href) {
        try {
          const targetUrl = new URL(element.href, page.url());
          const currentUrl = new URL(page.url());
          
          // Only navigate if it's a different path
          if (targetUrl.pathname !== currentUrl.pathname || targetUrl.search !== currentUrl.search) {
            await page.goto(element.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(500);
            return true;
          }
        } catch {
          // Navigation failed
        }
      }

      return false;
    } catch (error: any) {
      console.log(`   ⚠️  Link click error: ${error.message}`);
      return false;
    }
  }

  /**
   * Clicks a button element
   */
  private static async clickButton(page: Page, element: InteractiveElement): Promise<boolean> {
    try {
      // Remove blocking overlays proactively
      await this.removeBlockingOverlays(page);

      const navigationPromise = page.waitForLoadState('domcontentloaded', { timeout: PLANNER_CONFIG.NAVIGATION_WAIT_TIMEOUT }).catch(() => {});

      // Strategy 1: Try by text with getByRole (if text available)
      if (element.text && element.text.trim().length > 0) {
        try {
          const button = page.getByRole('button', { name: element.text.trim() });
          await button.waitFor({ state: 'visible', timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT });
          await button.scrollIntoViewIfNeeded();
          
          // Check if clickable
          const isClickable = await button.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            return elementAtPoint === el || el.contains(elementAtPoint);
          });

          if (!isClickable) {
            await this.removeBlockingOverlays(page);
          }

          await button.click({ timeout: PLANNER_CONFIG.CLICK_TIMEOUT, force: false });
          await navigationPromise;
          await page.waitForTimeout(500);
          return true;
        } catch {
          // Try force click
          try {
            const button = page.getByRole('button', { name: element.text.trim() });
            await button.scrollIntoViewIfNeeded();
            await button.click({ timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT, force: true });
            await navigationPromise;
            await page.waitForTimeout(500);
            return true;
          } catch {
            // Try next strategy
          }
        }
      }

      // Strategy 2: Try shadow DOM (if shadowPath available)
      if ((element as any).shadowPath) {
        try {
          const clicked = await page.evaluate((args: { shadowPath: string; selector: string }) => {
            const parts = args.shadowPath.split(' > ');
            let root: any = document;
            for (const part of parts) {
              const el = root.querySelector(part);
              if (el && el.shadowRoot) {
                root = el.shadowRoot;
              } else {
                return false;
              }
            }
            const button = root.querySelector(args.selector);
            if (button) {
              button.scrollIntoView({ behavior: 'smooth', block: 'center' });
              button.click();
              return true;
            }
            return false;
          }, { shadowPath: (element as any).shadowPath, selector: element.selector });
          
          if (clicked) {
            await navigationPromise;
            await page.waitForTimeout(500);
            return true;
          }
        } catch {
          // Try next strategy
        }
      }

      // Strategy 3: Try by selector
      if (element.selector && element.selector.length > 0) {
        try {
          const buttonLocator = element.selector.startsWith('#')
            ? page.locator(element.selector)
            : page.locator(element.selector).first();
          
          await buttonLocator.waitFor({ state: 'visible', timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT });
          await buttonLocator.scrollIntoViewIfNeeded();
          
          // Check if clickable
          const isClickable = await buttonLocator.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            return elementAtPoint === el || el.contains(elementAtPoint);
          });

          if (!isClickable) {
            await this.removeBlockingOverlays(page);
          }

          await buttonLocator.click({ timeout: PLANNER_CONFIG.CLICK_TIMEOUT, force: false });
          await navigationPromise;
          await page.waitForTimeout(500);
          return true;
        } catch {
          // Try force click
          try {
            const buttonLocator = element.selector.startsWith('#')
              ? page.locator(element.selector)
              : page.locator(element.selector).first();
            await buttonLocator.scrollIntoViewIfNeeded();
            await buttonLocator.click({ timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT, force: true });
            await navigationPromise;
            await page.waitForTimeout(500);
            return true;
          } catch {
            // All strategies failed
          }
        }
      }

      return false;
    } catch (error: any) {
      console.log(`   ⚠️  Button click error: ${error.message}`);
      return false;
    }
  }

  /**
   * Fills an input element
   */
  private static async fillInput(page: Page, element: InteractiveElement): Promise<boolean> {
    try {
      if ((element as any).shadowPath) {
        await page.evaluate((args: { shadowPath: string; selector: string; value: string }) => {
          const parts = args.shadowPath.split(' > ');
          let root: any = document;
          for (const part of parts) {
            const el = root.querySelector(part);
            if (el && el.shadowRoot) {
              root = el.shadowRoot;
            } else {
              return;
            }
          }
          const input = root.querySelector(args.selector);
          if (input) {
            input.value = args.value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, { shadowPath: (element as any).shadowPath, selector: element.selector, value: 'test data' });
        return true;
      } else if (element.selector.startsWith('#')) {
        await page.locator(element.selector).fill('test data', { timeout: 2000 });
        return true;
      } else if (element.selector.includes('name=')) {
        await page.locator(element.selector).fill('test data', { timeout: 2000 });
        return true;
      } else if (element.text) {
        await page.getByPlaceholder(element.text).fill('test data', { timeout: 2000 });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Interacts with an element (click or fill) and returns whether navigation occurred
   */
  static async interactWithElement(page: Page, element: InteractiveElement): Promise<boolean> {
    const urlBefore = page.url();
    await page.waitForTimeout(200);

    console.log(`   🔍 Attempting to interact with: ${element.type} "${element.text || element.selector}"`);
    if (element.isLink && element.href) {
      console.log(`   🔗 Link href: ${element.href}`);
    }

    let clickSucceeded = false;

    try {
      if (element.isLink && element.href) {
        clickSucceeded = await this.clickLink(page, element);
        console.log(`   ${clickSucceeded ? '✅' : '❌'} Link click ${clickSucceeded ? 'succeeded' : 'failed'}`);
      } else if (element.type === 'button') {
        clickSucceeded = await this.clickButton(page, element);
        console.log(`   ${clickSucceeded ? '✅' : '❌'} Button click ${clickSucceeded ? 'succeeded' : 'failed'}`);
      } else if (element.type === 'input') {
        clickSucceeded = await this.fillInput(page, element);
        console.log(`   ${clickSucceeded ? '✅' : '❌'} Input fill ${clickSucceeded ? 'succeeded' : 'failed'}`);
      }

      if (clickSucceeded) {
        // Wait longer for navigation, especially for SPAs
        await page.waitForTimeout(PLANNER_CONFIG.PAGE_SETTLE_TIMEOUT);
        
        // Also wait for network to be idle (for SPAs that use client-side routing)
        try {
          await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
        } catch {
          // Ignore networkidle timeout
        }
      } else {
        console.log(`   ❌ Click failed - element may be blocked or not clickable`);
        await page.waitForTimeout(200);
        return false;
      }

      // Check if navigation occurred (including hash changes for SPAs)
      const urlAfter = page.url();
      const normalizedBefore = UrlNormalizer.normalize(urlBefore);
      const normalizedAfter = UrlNormalizer.normalize(urlAfter);

      // Also check for hash changes (SPA routing)
      let hashBefore = '';
      let hashAfter = '';
      try {
        hashBefore = new URL(urlBefore).hash;
        hashAfter = new URL(urlAfter).hash;
      } catch {
        // If URL parsing fails, try simple string extraction
        hashBefore = urlBefore.includes('#') ? urlBefore.split('#')[1] : '';
        hashAfter = urlAfter.includes('#') ? urlAfter.split('#')[1] : '';
      }
      const hashChanged = hashBefore !== hashAfter;

      if (normalizedAfter !== normalizedBefore || hashChanged) {
        if (hashChanged && normalizedAfter === normalizedBefore) {
          console.log(`   ✅ Hash navigation detected: ${hashBefore || '(none)'} → ${hashAfter || '(none)'}`);
        } else {
          console.log(`   ✅ Navigation detected: ${urlBefore} → ${urlAfter}`);
        }
        return true; // Navigation occurred
      }

      console.log(`   ⚠️  No URL change detected after click`);
      console.log(`   🔍 Before: ${urlBefore}, After: ${urlAfter}`);
      
      // If it's a link with an href, try direct navigation as fallback
      if (element.isLink && element.href && clickSucceeded) {
        const href = element.href;
        const currentUrl = new URL(page.url());
        const targetUrl = new URL(href, page.url());
        
        // Only try direct navigation if it's a different path
        if (targetUrl.pathname !== currentUrl.pathname || targetUrl.search !== currentUrl.search) {
          console.log(`   🔄 Attempting direct navigation to: ${href}`);
          try {
            await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(500);
            const finalUrl = page.url();
            const finalNormalized = UrlNormalizer.normalize(finalUrl);
            if (finalNormalized !== normalizedBefore) {
              console.log(`   ✅ Direct navigation succeeded: ${finalUrl}`);
              return true;
            }
          } catch (navError: any) {
            console.log(`   ❌ Direct navigation failed: ${navError.message}`);
          }
        }
      }

      // Close any modals that appeared
      await page.waitForTimeout(200);
      const dialog = page.locator('[role="dialog"], .modal, .dialog').first();
      if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
        console.log(`   🔄 Closing modal/dialog...`);
        const closeButton = dialog.locator('button[aria-label*="close" i], button:has-text("Close"), button:has-text("×")').first();
        if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
          await closeButton.click();
          await page.waitForTimeout(200);
        }
      }

      return false; // No navigation
    } catch (error: any) {
      console.log(`   ❌ Interaction error: ${error.message}`);
      return false;
    }
  }
}


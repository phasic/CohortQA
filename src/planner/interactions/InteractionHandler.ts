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
   * Clicks a link element
   */
  private static async clickLink(page: Page, element: InteractiveElement): Promise<boolean> {
    try {
      const navigationPromise = page.waitForLoadState('domcontentloaded', { timeout: PLANNER_CONFIG.NAVIGATION_WAIT_TIMEOUT }).catch(() => {});

      if (element.text && element.text.trim().length > 0) {
        const link = page.getByRole('link', { name: element.text });
        try {
          await link.waitFor({ state: 'visible', timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT });
          await link.waitFor({ state: 'attached', timeout: 2000 });
          await link.scrollIntoViewIfNeeded();

          const isClickable = await link.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            return elementAtPoint === el || el.contains(elementAtPoint);
          });

          if (!isClickable) {
            await page.evaluate(() => {
              const overlays = document.querySelectorAll('[class*="overlay"], [class*="modal"], [id*="cookie"]');
              overlays.forEach((overlay: Element) => {
                (overlay as HTMLElement).style.display = 'none';
              });
            });
            await page.waitForTimeout(200);
          }

          await link.click({ timeout: PLANNER_CONFIG.CLICK_TIMEOUT, force: false });
          await navigationPromise;
          await page.waitForTimeout(500);
          return true;
        } catch {
          try {
            await link.click({ timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT, force: true });
            await navigationPromise;
            await page.waitForTimeout(500);
            return true;
          } catch {
            return false;
          }
        }
      } else if ((element as any).shadowPath) {
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
          const link = root.querySelector(`a[href="${args.href}"]`);
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
        return false;
      } else {
        const linkLocator = page.locator(element.selector).first();
        try {
          await linkLocator.waitFor({ state: 'visible', timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT });
          await linkLocator.waitFor({ state: 'attached', timeout: 2000 });
          await linkLocator.scrollIntoViewIfNeeded();
          await linkLocator.click({ timeout: PLANNER_CONFIG.CLICK_TIMEOUT, force: false });
          await navigationPromise;
          await page.waitForTimeout(500);
          return true;
        } catch {
          try {
            await linkLocator.click({ timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT, force: true });
            await navigationPromise;
            await page.waitForTimeout(500);
            return true;
          } catch {
            // Last resort: try direct navigation
            try {
              await page.goto(element.href!, { waitUntil: 'domcontentloaded', timeout: 5000 });
              return true;
            } catch {
              return false;
            }
          }
        }
      }
    } catch {
      return false;
    }
  }

  /**
   * Clicks a button element
   */
  private static async clickButton(page: Page, element: InteractiveElement): Promise<boolean> {
    try {
      const navigationPromise = page.waitForLoadState('domcontentloaded', { timeout: PLANNER_CONFIG.NAVIGATION_WAIT_TIMEOUT }).catch(() => {});

      if (element.text && element.text.trim().length > 0) {
        const button = page.getByRole('button', { name: element.text });
        await button.waitFor({ state: 'visible', timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT }).catch(() => {});
        await button.scrollIntoViewIfNeeded();
        await button.click({ timeout: PLANNER_CONFIG.CLICK_TIMEOUT, force: false });
        await navigationPromise;
        await page.waitForTimeout(500);
        return true;
      } else if ((element as any).shadowPath) {
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
        return false;
      } else {
        const buttonLocator = element.selector.startsWith('#')
          ? page.locator(element.selector)
          : page.locator(element.selector).first();
        
        await buttonLocator.waitFor({ state: 'visible', timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT }).catch(() => {});
        await buttonLocator.scrollIntoViewIfNeeded();
        await buttonLocator.click({ timeout: PLANNER_CONFIG.CLICK_TIMEOUT, force: false });
        await navigationPromise;
        await page.waitForTimeout(500);
        return true;
      }
    } catch {
      // Try force click as last resort
      try {
        if (element.selector) {
          await page.locator(element.selector).first().click({ timeout: PLANNER_CONFIG.ELEMENT_WAIT_TIMEOUT, force: true });
          return true;
        }
      } catch {
        return false;
      }
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

    let clickSucceeded = false;

    try {
      if (element.isLink && element.href) {
        clickSucceeded = await this.clickLink(page, element);
      } else if (element.type === 'button') {
        clickSucceeded = await this.clickButton(page, element);
      } else if (element.type === 'input') {
        clickSucceeded = await this.fillInput(page, element);
      }

      if (clickSucceeded) {
        await page.waitForTimeout(PLANNER_CONFIG.PAGE_SETTLE_TIMEOUT);
      } else {
        console.log(`   ❌ Click failed - element may be blocked or not clickable`);
        await page.waitForTimeout(200);
        return false;
      }

      // Check if navigation occurred
      const urlAfter = page.url();
      const normalizedBefore = UrlNormalizer.normalize(urlBefore);
      const normalizedAfter = UrlNormalizer.normalize(urlAfter);

      if (normalizedAfter !== normalizedBefore) {
        return true; // Navigation occurred
      }

      // Close any modals that appeared
      await page.waitForTimeout(200);
      const dialog = page.locator('[role="dialog"], .modal, .dialog').first();
      if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
        const closeButton = dialog.locator('button[aria-label*="close" i], button:has-text("Close"), button:has-text("×")').first();
        if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
          await closeButton.click();
          await page.waitForTimeout(200);
        }
      }

      return false; // No navigation
    } catch {
      return false;
    }
  }
}


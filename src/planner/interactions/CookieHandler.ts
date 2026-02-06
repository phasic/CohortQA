import { Page } from '@playwright/test';

/**
 * Handles cookie consent popups
 */
export class CookieHandler {
  /**
   * Detects and handles cookie consent popups
   */
  static async handleCookiePopup(page: Page): Promise<void> {
    try {
      // Wait briefly for popups to appear
      await page.waitForTimeout(300);

      // Common cookie popup selectors
      const cookieSelectors = [
        '[id*="cookie" i]',
        '[class*="cookie" i]',
        '[id*="consent" i]',
        '[class*="consent" i]',
        '[id*="gdpr" i]',
        '[class*="gdpr" i]',
        '[role="dialog"]',
        '.modal',
        '.dialog'
      ];

      for (const selector of cookieSelectors) {
        try {
          const popup = page.locator(selector).first();
          if (await popup.isVisible({ timeout: 1000 }).catch(() => false)) {
            // Find all interactive elements in the popup (buttons, links)
            const buttons = await popup.locator('button, [role="button"], input[type="button"], input[type="submit"], a[href]').all();

            if (buttons.length > 0) {
              // Randomly select one button
              const randomIndex = Math.floor(Math.random() * buttons.length);
              const randomButton = buttons[randomIndex];

              try {
                // Scroll into view and click
                await randomButton.scrollIntoViewIfNeeded();
                await randomButton.click({ timeout: 3000 });
                await page.waitForTimeout(300);
                return; // Handled, exit
              } catch (clickError) {
                // Failed to click button, trying next
                continue;
              }
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      // No cookie popup found or error handling it, continue
    }
  }
}


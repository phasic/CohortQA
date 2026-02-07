import { Page } from '@playwright/test';

/**
 * Utility for handling page loading and waiting logic
 */
export class PageLoader {
  /**
   * Waits for page to be fully loaded and interactive
   */
  static async waitForPageReady(page: Page): Promise<void> {
    console.log('⏳ Waiting for page to settle...');
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    } catch {
      // Ignore networkidle timeout
    }

    // Wait for body to have content
    try {
      await page
        .waitForFunction(
          () => document.body && document.body.children.length > 0,
          { timeout: 10000 }
        )
        .catch(() => {});
    } catch {
      // Ignore if body check fails
    }

    await page.waitForTimeout(3000); // Give extra time for JS to render
    console.log(`✅ Loaded page: ${page.url()}`);
  }

  /**
   * Waits for JavaScript to render interactive content
   */
  static async waitForInteractiveContent(page: Page): Promise<void> {
    console.log('⏳ Waiting for JavaScript to render content...');

    // Try waiting for common interactive elements to appear
    try {
      await Promise.race([
        page.waitForSelector('a[href]', { timeout: 10000 }).catch(() => {}),
        page.waitForSelector('button', { timeout: 10000 }).catch(() => {}),
        page.waitForSelector('[role="button"]', { timeout: 10000 }).catch(() => {}),
        page.waitForSelector('[role="link"]', { timeout: 10000 }).catch(() => {}),
        page.waitForTimeout(10000), // Max wait
      ]);
    } catch {
      // Ignore
    }

    // Wait for network to be completely idle
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    } catch {
      // Ignore
    }

    // Additional wait for JavaScript frameworks
    await page.waitForTimeout(2000);
  }

  /**
   * Waits for navigation to complete and page to settle
   */
  static async waitForNavigation(page: Page): Promise<void> {
    await page.waitForTimeout(1000);

    // Also wait for network to be idle (for SPAs)
    try {
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
    } catch {
      // Ignore networkidle timeout
    }
  }
}


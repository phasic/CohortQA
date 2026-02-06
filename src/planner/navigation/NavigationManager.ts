import { Page } from '@playwright/test';
import { UrlNormalizer } from '../utils/UrlNormalizer.js';

/**
 * Manages navigation and ensures we stay on the same domain
 */
export class NavigationManager {
  private baseUrl: string;
  private initialUrl: string;

  constructor(baseUrl: string, initialUrl: string) {
    this.baseUrl = baseUrl;
    this.initialUrl = initialUrl;
  }

  /**
   * Ensures we're still on the same domain, navigates back if not
   */
  async ensureSameDomain(page: Page): Promise<void> {
    try {
      const currentUrl = page.url();
      const currentOrigin = new URL(currentUrl).origin;

      if (currentOrigin !== this.baseUrl) {
        console.warn(`Detected navigation away from domain (${currentOrigin} vs ${this.baseUrl}). Navigating back to ${this.initialUrl}...`);
        await page.goto(this.initialUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
        await page.waitForTimeout(500);
      }
    } catch (error) {
      console.warn('Error checking domain, attempting to navigate back:', error);
      try {
        await page.goto(this.initialUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
      } catch {
        // If we can't navigate back, at least we tried
      }
    }
  }

  /**
   * Forces navigation to a new unvisited page by finding an unvisited link
   */
  async forceNavigateToNewPage(page: Page, visitedUrls: Set<string>): Promise<boolean> {
    try {
      // Get all links on the current page
      const unvisitedLink: { href: string; text: string } | null = await page.evaluate((args: { baseOrigin: string; visitedUrls: string[] }) => {
        const anchors = Array.from(document.querySelectorAll('a[href]'))
          .map((el: Element) => {
            const anchor = el as HTMLAnchorElement;
            try {
              const url = new URL(anchor.href);
              const isSameOrigin = url.origin === args.baseOrigin;
              const isAnchor = anchor.href.includes('#');

              if (!isSameOrigin || isAnchor) {
                return null;
              }

              return {
                href: anchor.href,
                text: (anchor.textContent || '').trim() || anchor.getAttribute('aria-label') || ''
              };
            } catch {
              return null;
            }
          })
          .filter((link): link is { href: string; text: string } => link !== null)
          .find(link => {
            const normalizedUrl = link.href.split('#')[0].replace(/\/$/, '');
            return !args.visitedUrls.includes(normalizedUrl) && link.href !== window.location.href;
          }) || null;

        return unvisitedLink;
      }, {
        baseOrigin: this.baseUrl,
        visitedUrls: Array.from(visitedUrls)
      });

      if (unvisitedLink) {
        const normalizedUrl = UrlNormalizer.normalize(unvisitedLink.href);
        if (!visitedUrls.has(normalizedUrl)) {
          if (unvisitedLink.text && unvisitedLink.text.trim().length > 0) {
            await page.getByRole('link', { name: unvisitedLink.text }).click({ timeout: 5000 });
          } else {
            await page.goto(unvisitedLink.href, { waitUntil: 'networkidle', timeout: 10000 });
          }

          await page.waitForLoadState('domcontentloaded', { timeout: 3000 });
          await this.ensureSameDomain(page);
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }
}

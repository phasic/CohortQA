import { test as base } from '@playwright/test';

/**
 * Custom test fixture that adds cookie consent bypass to all test contexts
 * The init script must be added to the context BEFORE pages are created
 */
export const test = base.extend({
  // Extend the context fixture to add cookie setup before pages are created
  context: async ({ context }, use) => {
    // Set cookiesOptin cookie via JavaScript before any page loads
    // This ensures the cookie is available before cookie consent popup logic runs
    await context.addInitScript(() => {
      // Set the cookie for the current domain
      document.cookie = 'cookiesOptin=true; path=/; SameSite=Lax';
    });
    
    await use(context);
  },
});

export { expect } from '@playwright/test';


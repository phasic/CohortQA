import { test, expect } from '@playwright/test';

test.describe('Step 1: Click on "Investing"', () => {
  test('should click and verify navigation to /en/individuals/investing', async ({ page, context }) => {
    // Set cookies before page loads (same approach as planner)
    await page.addInitScript(({ cookies, defaultDomain, defaultPath, defaultSecure }) => {
      cookies.forEach(cookieConfig => {
        const domain = cookieConfig.domain || defaultDomain;
        const path = cookieConfig.path || defaultPath;
        const secure = cookieConfig.secure ?? defaultSecure;
        const sameSite = cookieConfig.sameSite || 'Lax';
        let cookieString = `${cookieConfig.name}=${cookieConfig.value}`;
        if (path) cookieString += `; path=${path}`;
        if (domain) cookieString += `; domain=${domain}`;
        if (secure) cookieString += '; secure';
        if (sameSite) cookieString += `; samesite=${sameSite}`;
        document.cookie = cookieString;
      });
    }, {
      cookies: [
      { name: 'cookiesOptin', value: 'true', domain: undefined, path: undefined, secure: undefined, sameSite: undefined }
      ],
      defaultDomain: 'www.ing.be',
      defaultPath: '/',
      defaultSecure: true
    });

    // Also set cookies via Playwright API (for proper cookie management)
    const cookies = [
      {
        name: 'cookiesOptin',
        value: 'true',
        domain: 'www.ing.be',
        path: '/',
        secure: true,
        sameSite: 'Lax',
        httpOnly: false
      }
    ];
    await context.addCookies(cookies);

    // Navigate to start URL
    await page.goto('https://www.ing.be/en/individuals', { waitUntil: 'domcontentloaded' });
    // Reload page so it picks up cookies before popup scripts run
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL('https://www.ing.be/en/individuals');

    // Execute step 1: CLICK
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().waitFor({ state: 'visible' });
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().scrollIntoViewIfNeeded();
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().click();
    await page.waitForLoadState('networkidle');

    // Verify expected results
    await expect(page).toHaveURL('https://www.ing.be/en/individuals/investing');
    await expect(page).toHaveTitle('Investing money - ING Belgium');
  });
});

test.describe('Step 2: Click on "What is investing?"', () => {
  test('should click and verify expected results', async ({ page, context }) => {
    // Set cookies before page loads (same approach as planner)
    await page.addInitScript(({ cookies, defaultDomain, defaultPath, defaultSecure }) => {
      cookies.forEach(cookieConfig => {
        const domain = cookieConfig.domain || defaultDomain;
        const path = cookieConfig.path || defaultPath;
        const secure = cookieConfig.secure ?? defaultSecure;
        const sameSite = cookieConfig.sameSite || 'Lax';
        let cookieString = `${cookieConfig.name}=${cookieConfig.value}`;
        if (path) cookieString += `; path=${path}`;
        if (domain) cookieString += `; domain=${domain}`;
        if (secure) cookieString += '; secure';
        if (sameSite) cookieString += `; samesite=${sameSite}`;
        document.cookie = cookieString;
      });
    }, {
      cookies: [
      { name: 'cookiesOptin', value: 'true', domain: undefined, path: undefined, secure: undefined, sameSite: undefined }
      ],
      defaultDomain: 'www.ing.be',
      defaultPath: '/',
      defaultSecure: true
    });

    // Also set cookies via Playwright API (for proper cookie management)
    const cookies = [
      {
        name: 'cookiesOptin',
        value: 'true',
        domain: 'www.ing.be',
        path: '/',
        secure: true,
        sameSite: 'Lax',
        httpOnly: false
      }
    ];
    await context.addCookies(cookies);

    // Navigate to start URL
    await page.goto('https://www.ing.be/en/individuals', { waitUntil: 'domcontentloaded' });
    // Reload page so it picks up cookies before popup scripts run
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL('https://www.ing.be/en/individuals');

    // Step 1: CLICK
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().waitFor({ state: 'visible' });
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().scrollIntoViewIfNeeded();
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().click();
    await page.waitForLoadState('networkidle');

    // Execute step 2: CLICK
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).waitFor({ state: 'visible' });
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).scrollIntoViewIfNeeded();
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).click();

    // Verify expected results
  });
});

test.describe('Step 3: Click on "How do I start to invest?"', () => {
  test('should click and verify expected results', async ({ page, context }) => {
    // Set cookies before page loads (same approach as planner)
    await page.addInitScript(({ cookies, defaultDomain, defaultPath, defaultSecure }) => {
      cookies.forEach(cookieConfig => {
        const domain = cookieConfig.domain || defaultDomain;
        const path = cookieConfig.path || defaultPath;
        const secure = cookieConfig.secure ?? defaultSecure;
        const sameSite = cookieConfig.sameSite || 'Lax';
        let cookieString = `${cookieConfig.name}=${cookieConfig.value}`;
        if (path) cookieString += `; path=${path}`;
        if (domain) cookieString += `; domain=${domain}`;
        if (secure) cookieString += '; secure';
        if (sameSite) cookieString += `; samesite=${sameSite}`;
        document.cookie = cookieString;
      });
    }, {
      cookies: [
      { name: 'cookiesOptin', value: 'true', domain: undefined, path: undefined, secure: undefined, sameSite: undefined }
      ],
      defaultDomain: 'www.ing.be',
      defaultPath: '/',
      defaultSecure: true
    });

    // Also set cookies via Playwright API (for proper cookie management)
    const cookies = [
      {
        name: 'cookiesOptin',
        value: 'true',
        domain: 'www.ing.be',
        path: '/',
        secure: true,
        sameSite: 'Lax',
        httpOnly: false
      }
    ];
    await context.addCookies(cookies);

    // Navigate to start URL
    await page.goto('https://www.ing.be/en/individuals', { waitUntil: 'domcontentloaded' });
    // Reload page so it picks up cookies before popup scripts run
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL('https://www.ing.be/en/individuals');

    // Step 1: CLICK
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().waitFor({ state: 'visible' });
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().scrollIntoViewIfNeeded();
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().click();
    await page.waitForLoadState('networkidle');

    // Step 2: CLICK
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).waitFor({ state: 'visible' });
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).scrollIntoViewIfNeeded();
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).click();

    // Execute step 3: CLICK
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'How do I start to invest?' }).waitFor({ state: 'visible' });
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'How do I start to invest?' }).scrollIntoViewIfNeeded();
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'How do I start to invest?' }).click();

    // Verify expected results
  });
});

test.describe('Step 4: Click on "What is investing?"', () => {
  test('should click and verify expected results', async ({ page, context }) => {
    // Set cookies before page loads (same approach as planner)
    await page.addInitScript(({ cookies, defaultDomain, defaultPath, defaultSecure }) => {
      cookies.forEach(cookieConfig => {
        const domain = cookieConfig.domain || defaultDomain;
        const path = cookieConfig.path || defaultPath;
        const secure = cookieConfig.secure ?? defaultSecure;
        const sameSite = cookieConfig.sameSite || 'Lax';
        let cookieString = `${cookieConfig.name}=${cookieConfig.value}`;
        if (path) cookieString += `; path=${path}`;
        if (domain) cookieString += `; domain=${domain}`;
        if (secure) cookieString += '; secure';
        if (sameSite) cookieString += `; samesite=${sameSite}`;
        document.cookie = cookieString;
      });
    }, {
      cookies: [
      { name: 'cookiesOptin', value: 'true', domain: undefined, path: undefined, secure: undefined, sameSite: undefined }
      ],
      defaultDomain: 'www.ing.be',
      defaultPath: '/',
      defaultSecure: true
    });

    // Also set cookies via Playwright API (for proper cookie management)
    const cookies = [
      {
        name: 'cookiesOptin',
        value: 'true',
        domain: 'www.ing.be',
        path: '/',
        secure: true,
        sameSite: 'Lax',
        httpOnly: false
      }
    ];
    await context.addCookies(cookies);

    // Navigate to start URL
    await page.goto('https://www.ing.be/en/individuals', { waitUntil: 'domcontentloaded' });
    // Reload page so it picks up cookies before popup scripts run
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL('https://www.ing.be/en/individuals');

    // Step 1: CLICK
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().waitFor({ state: 'visible' });
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().scrollIntoViewIfNeeded();
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().click();
    await page.waitForLoadState('networkidle');

    // Step 2: CLICK
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).waitFor({ state: 'visible' });
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).scrollIntoViewIfNeeded();
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).click();

    // Step 3: CLICK
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'How do I start to invest?' }).waitFor({ state: 'visible' });
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'How do I start to invest?' }).scrollIntoViewIfNeeded();
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'How do I start to invest?' }).click();

    // Execute step 4: CLICK
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).waitFor({ state: 'visible' });
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).scrollIntoViewIfNeeded();
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).click();

    // Verify expected results
  });
});

test.describe('Step 5: Click on "Economy and financial markets"', () => {
  test('should click and verify navigation to /en/individuals/news/economy-and-financial-markets', async ({ page, context }) => {
    // Set cookies before page loads (same approach as planner)
    await page.addInitScript(({ cookies, defaultDomain, defaultPath, defaultSecure }) => {
      cookies.forEach(cookieConfig => {
        const domain = cookieConfig.domain || defaultDomain;
        const path = cookieConfig.path || defaultPath;
        const secure = cookieConfig.secure ?? defaultSecure;
        const sameSite = cookieConfig.sameSite || 'Lax';
        let cookieString = `${cookieConfig.name}=${cookieConfig.value}`;
        if (path) cookieString += `; path=${path}`;
        if (domain) cookieString += `; domain=${domain}`;
        if (secure) cookieString += '; secure';
        if (sameSite) cookieString += `; samesite=${sameSite}`;
        document.cookie = cookieString;
      });
    }, {
      cookies: [
      { name: 'cookiesOptin', value: 'true', domain: undefined, path: undefined, secure: undefined, sameSite: undefined }
      ],
      defaultDomain: 'www.ing.be',
      defaultPath: '/',
      defaultSecure: true
    });

    // Also set cookies via Playwright API (for proper cookie management)
    const cookies = [
      {
        name: 'cookiesOptin',
        value: 'true',
        domain: 'www.ing.be',
        path: '/',
        secure: true,
        sameSite: 'Lax',
        httpOnly: false
      }
    ];
    await context.addCookies(cookies);

    // Navigate to start URL
    await page.goto('https://www.ing.be/en/individuals', { waitUntil: 'domcontentloaded' });
    // Reload page so it picks up cookies before popup scripts run
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL('https://www.ing.be/en/individuals');

    // Step 1: CLICK
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().waitFor({ state: 'visible' });
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().scrollIntoViewIfNeeded();
    await page.locator('a.link-unstyled.font-md[href="/en/individuals/investing"]').filter({ hasText: 'Investing' }).first().click();
    await page.waitForLoadState('networkidle');

    // Step 2: CLICK
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).waitFor({ state: 'visible' });
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).scrollIntoViewIfNeeded();
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).click();

    // Step 3: CLICK
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'How do I start to invest?' }).waitFor({ state: 'visible' });
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'How do I start to invest?' }).scrollIntoViewIfNeeded();
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'How do I start to invest?' }).click();

    // Step 4: CLICK
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).waitFor({ state: 'visible' });
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).scrollIntoViewIfNeeded();
    await page.locator('ing-accordion-invoker-button').filter({ hasText: 'What is investing?' }).click();

    // Execute step 5: CLICK
    await page.locator('a.card__anchor[href="/en/individuals/news/economy-and-financial-markets"]').filter({ hasText: 'Economy and financial markets' }).first().waitFor({ state: 'visible' });
    await page.locator('a.card__anchor[href="/en/individuals/news/economy-and-financial-markets"]').filter({ hasText: 'Economy and financial markets' }).first().scrollIntoViewIfNeeded();
    await page.locator('a.card__anchor[href="/en/individuals/news/economy-and-financial-markets"]').filter({ hasText: 'Economy and financial markets' }).first().click();
    await page.waitForLoadState('networkidle');

    // Verify expected results
    await expect(page).toHaveURL('https://www.ing.be/en/individuals/news/economy-and-financial-markets');
    await expect(page).toHaveTitle('Economy: publications from our experts to understand the news - ING Belgium');

    // Verify notable elements
    await expect(page.locator('#articles-and-forecasts')).toBeVisible();
    await expect(page.locator('#articles-and-forecasts')).toContainText('Articles and forecasts');
    await expect(page.locator('#ecocheck-podcast')).toBeVisible();
    await expect(page.locator('#ecocheck-podcast')).toContainText('EcoCheck podcast');
    await expect(page.locator('#meet-our-experts')).toBeVisible();
    await expect(page.locator('#meet-our-experts')).toContainText('Meet our experts');
    await expect(page.locator('#get-more-info-and-tips')).toBeVisible();
    await expect(page.locator('#get-more-info-and-tips')).toContainText('Get more info and tips');
    await expect(page.locator('.link-unstyled.font-md[href=\'/en/individuals\']').filter({ hasText: 'Home' })).toBeVisible();
    await expect(page.locator('.link-unstyled.font-md[href=\'/en/individuals\']').filter({ hasText: 'Home' })).toContainText('Home');
    await expect(page.locator('.link-unstyled.font-md[href=\'/en/individuals/services/get-in-touch\']').filter({ hasText: 'Contact' })).toBeVisible();
    await expect(page.locator('.link-unstyled.font-md[href=\'/en/individuals/services/get-in-touch\']').filter({ hasText: 'Contact' })).toContainText('Contact');
  });
});


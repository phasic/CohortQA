import { chromium, Browser, Page, BrowserContext } from '@playwright/test';
import { Config } from '../types.js';

export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log('🌐 Initializing browser...');
    
    this.browser = await chromium.launch({
      headless: this.config.browser.headless,
    });
    
    // Create context - cookies are enabled by default in Playwright
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    
    // Set default timeout
    this.page.setDefaultTimeout(this.config.browser.timeout);
    
    console.log('  ✅ Browser initialized');
    if (this.config.browser.cookies && this.config.browser.cookies.length > 0) {
      console.log(`  🍪 ${this.config.browser.cookies.length} cookie(s) configured (will be set on navigation)`);
    }
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.page || !this.context) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    
    // If we have cookies configured, inject them via JavaScript before page loads
    if (this.config.browser.cookies && this.config.browser.cookies.length > 0) {
      const urlObj = new URL(url);
      const defaultDomain = urlObj.hostname;
      const defaultPath = '/';
      const defaultSecure = urlObj.protocol === 'https:';
      
      // Inject cookie-setting script that runs before any page scripts
      await this.page.addInitScript(({ cookies, defaultDomain, defaultPath, defaultSecure }: {
        cookies: any[];
        defaultDomain: string;
        defaultPath: string;
        defaultSecure: boolean;
      }) => {
        cookies.forEach(cookieConfig => {
          const domain = cookieConfig.domain || defaultDomain;
          const path = cookieConfig.path || defaultPath;
          const secure = cookieConfig.secure ?? defaultSecure;
          const sameSite = cookieConfig.sameSite || 'Lax';
          
          // Build cookie string
          let cookieString = `${cookieConfig.name}=${cookieConfig.value}`;
          if (path) cookieString += `; path=${path}`;
          if (domain) cookieString += `; domain=${domain}`;
          if (secure) cookieString += `; secure`;
          if (sameSite) cookieString += `; samesite=${sameSite}`;
          
          // Set cookie via document.cookie (runs before page scripts)
          document.cookie = cookieString;
        });
      }, {
        cookies: this.config.browser.cookies,
        defaultDomain,
        defaultPath,
        defaultSecure
      });
    }
    
    console.log(`🔗 Navigating to: ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Also set cookies via Playwright API (for proper cookie management)
    if (this.config.browser.cookies && this.config.browser.cookies.length > 0) {
      try {
        const urlObj = new URL(this.page.url());
        const defaultDomain = urlObj.hostname;
        const defaultPath = '/';
        const defaultSecure = urlObj.protocol === 'https:';
        
        const cookiesToSet = this.config.browser.cookies.map(cookieConfig => ({
          name: cookieConfig.name,
          value: cookieConfig.value,
          domain: cookieConfig.domain || defaultDomain,
          path: cookieConfig.path || defaultPath,
          httpOnly: cookieConfig.httpOnly ?? false,
          secure: cookieConfig.secure ?? defaultSecure,
          sameSite: (cookieConfig.sameSite || 'Lax') as 'Strict' | 'Lax' | 'None',
        }));
        
        await this.context.addCookies(cookiesToSet);
        
        const cookieNames = cookiesToSet.map(c => c.name).join(', ');
        console.log(`  🍪 Set ${cookiesToSet.length} cookie(s): ${cookieNames}`);
        
        // Reload the page so it picks up the cookies before popup scripts run
        await this.page.reload({ waitUntil: 'networkidle' });
      } catch (error: any) {
        console.log(`  ⚠️  Failed to set cookies: ${error.message}`);
      }
    } else {
      await this.page.waitForLoadState('networkidle');
    }
    
    await this.page.waitForTimeout(this.config.navigation.wait_after_navigation);
    console.log(`  ✅ Navigation complete. Current URL: ${this.page.url()}`);
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    return this.page;
  }

  getCurrentUrl(): string {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    return this.page.url();
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      console.log('  🔒 Browser closed');
    }
  }
}


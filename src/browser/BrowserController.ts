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
    
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    
    // Set default timeout
    this.page.setDefaultTimeout(this.config.browser.timeout);
    
    console.log('✅ Browser initialized');
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    
    console.log(`🔗 Navigating to: ${url}`);
    await this.page.goto(url, { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(this.config.navigation.wait_after_navigation);
    console.log(`✅ Navigation complete. Current URL: ${this.page.url()}`);
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
      console.log('🔒 Browser closed');
    }
  }
}


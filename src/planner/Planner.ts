import { chromium, Browser, Page, BrowserContext } from '@playwright/test';
import { DecisionMaker, type InteractiveElement } from '../ai/DecisionMaker.js';
import { TestPlan, PageInfo } from './types.js';
import { PLANNER_CONFIG } from './config.js';
import { UrlNormalizer } from './utils/UrlNormalizer.js';
import { InteractionTracker } from './utils/InteractionTracker.js';
import { ElementDetector } from './elements/ElementDetector.js';
import { CookieHandler } from './interactions/CookieHandler.js';
import { NavigationManager } from './navigation/NavigationManager.js';
import { InteractionHandler } from './interactions/InteractionHandler.js';
import { PageAnalyzer } from './analysis/PageAnalyzer.js';
import { TestPlanGenerator } from './generation/TestPlanGenerator.js';
import { MarkdownExporter } from './generation/MarkdownExporter.js';
import { TTS } from '../utils/tts/TTS.js';
import { ConfigDisplay } from './utils/ConfigDisplay.js';
import { PageStateLogger } from './utils/PageStateLogger.js';
import { PageLoader } from './utils/PageLoader.js';
import { ElementSelector, type ElementSelectionResult } from './utils/ElementSelector.js';
import chalk from 'chalk';

/**
 * Main Planner class that orchestrates web application exploration
 */
export class Planner {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private visitedUrls: Set<string> = new Set();
  private allPageInfo: PageInfo[] = [];
  private baseUrl: string = '';
  private initialUrl: string = '';
  private abortSignal: AbortSignal | null = null;
  private decisionMaker: DecisionMaker | null = null; // Initialize as null, create in initialize()
  private useAI: boolean = false;
  private currentMaxNavigations: number = 3;
  private interactionTracker: InteractionTracker = new InteractionTracker();
  private navigationManager!: NavigationManager;
  private tts: TTS | null = null;
  private headless: boolean = false;
  private personality?: string;

  /**
   * Initializes the browser and AI/TTS components
   */
  async initialize(useAI: boolean = false, enableTTS: boolean = false, headless: boolean = false): Promise<void> {
    this.headless = headless;
    
    // Only launch browser if it doesn't exist
    if (!this.browser) {
      console.log(`🔧 Initializing browser... (${headless ? 'headless' : 'headed'})`);
      this.browser = await chromium.launch({
        headless: headless,
        args: ['--disable-blink-features=AutomationControlled'], // Make browser less detectable
      });
      console.log(`✅ Browser launched (${headless ? 'headless' : 'headed'})`);
    }

    // Initialize decision maker AFTER environment variables are set (from API server)
    // This ensures the correct provider is detected
    // Always recreate to ensure env vars are read correctly
    this.decisionMaker = new DecisionMaker(this.personality);
    this.useAI = useAI && this.decisionMaker.isEnabled();

    // Get AI provider and model info
    const aiProvider = this.decisionMaker.getProvider();
    const aiModel = this.useAI && aiProvider !== 'heuristic' ? this.decisionMaker.getModel() : null;

    // Initialize TTS if enabled
    let ttsInfo: { provider: string; model?: string; voice?: string } | null = null;
    if (enableTTS) {
      this.tts = new TTS(true, this.personality as any);
      ttsInfo = await this.tts.getProviderInfo();
    }

    // Print configuration box
    ConfigDisplay.printConfigBox(aiProvider, aiModel, ttsInfo);

    if (useAI && !this.decisionMaker.isEnabled()) {
      console.log(chalk.yellow('⚠️  AI requested but not available. For Ollama, make sure it\'s running: ollama serve'));
      console.log(chalk.dim('   "No worries, I\'ll use my trusty heuristics instead. They\'re pretty good too!"'));
    }
  }

  /**
   * Main exploration method - navigates through the application and collects page information
   */
  async explore(
    url: string,
    seedTestPath?: string,
    maxNavigations: number = 3,
    useAI: boolean = false,
    enableTTS: boolean = false,
    headless: boolean = false,
    abortSignal?: AbortSignal,
    personality?: string
  ): Promise<TestPlan> {
    this.abortSignal = abortSignal || null;
    this.personality = personality || 'playful';
    // Initialize exploration state
    this.initializeExplorationState(url, maxNavigations);

    // Ensure browser is initialized
    await this.ensureBrowserInitialized(useAI, enableTTS, headless);

    // Recreate DecisionMaker with personality now that it's set
    // This ensures the personality is used when making AI decisions
    if (useAI) {
      console.log(`🔄 Recreating DecisionMaker with personality... (useAI=${useAI})`);
      this.decisionMaker = new DecisionMaker(this.personality);
      const wasEnabled = this.decisionMaker.isEnabled();
      this.useAI = useAI && wasEnabled;
      console.log(`🔍 Planner.explore: DecisionMaker.isEnabled()=${wasEnabled}, useAI=${useAI}, this.useAI=${this.useAI}`);
      
      if (this.personality) {
        console.log(`✅ Using personality: ${this.personality}`);
      } else {
        console.log('ℹ️  Using default personality (playful)');
      }
    } else {
      console.log(`🔍 Planner.explore: useAI is false, skipping DecisionMaker recreation`);
      this.useAI = false;
    }

    // Create fresh page context for this exploration
    await this.createFreshPageContext();

    try {
      // Navigate to initial URL and wait for page to be ready
      await this.navigateToInitialPage(url);

      // Analyze initial page
      await this.analyzeInitialPage();

      // Run exploration loop
      await this.runExplorationLoop(maxNavigations);

      // Generate and return test plan
      return this.generateTestPlan(url, seedTestPath);
    } catch (error: any) {
      throw new Error(`Exploration failed: ${error.message}`);
    }
  }

  /**
   * Initializes exploration state variables
   */
  private initializeExplorationState(url: string, maxNavigations: number): void {
    const initialUrlObj = new URL(url);
    this.baseUrl = initialUrlObj.origin;
    this.visitedUrls.clear();
    this.allPageInfo = [];
    this.initialUrl = url.split('#')[0].replace(/\/$/, '');
    this.currentMaxNavigations = maxNavigations;
    this.navigationManager = new NavigationManager(this.baseUrl, this.initialUrl);
    this.interactionTracker.clear();
  }

  /**
   * Ensures browser is initialized and updates AI/TTS settings if needed
   */
  private async ensureBrowserInitialized(useAI: boolean, enableTTS: boolean, headless: boolean = false): Promise<void> {
    if (!this.browser) {
      await this.initialize(useAI, enableTTS, headless);
    } else {
      // Update AI/TTS settings if needed
      if (useAI && !this.useAI) {
        this.decisionMaker = new DecisionMaker(this.personality);
        this.useAI = this.decisionMaker.isEnabled();
      } else if (useAI && this.decisionMaker && this.personality) {
        // Recreate DecisionMaker if personality is available but wasn't used
        this.decisionMaker = new DecisionMaker(this.personality);
        console.log('🔄 Updated DecisionMaker with personality');
      } else if (enableTTS && !this.tts) {
        this.tts = new TTS(true, this.personality as any);
      }
      // Update headless setting if changed
      if (headless !== this.headless) {
        this.headless = headless;
        // Note: Can't change headless mode of existing browser, would need to restart
        console.log(chalk.yellow(`⚠️  Headless setting changed to ${headless}, but browser already launched. Restart planner to apply.`));
      }
    }
  }

  /**
   * Creates a fresh browser context and page for exploration
   */
  private async createFreshPageContext(): Promise<void> {
    // Close existing page and context if they exist
    if (this.page) {
      try {
        const oldContext = this.page.context();
        await this.page.close();
        await oldContext.close().catch(() => {});
      } catch {
        // Page/context might already be closed
      }
    }

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // Create new context with cookie init script
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    // Set cookiesOptin cookie via JavaScript before any page loads
    await context.addInitScript(() => {
      document.cookie = 'cookiesOptin=true; path=/; SameSite=Lax';
    });

    // Create new page
    this.page = await context.newPage();

    // Navigate to about:blank first to ensure page is ready
    await this.page.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await this.page.waitForTimeout(100);

    console.log('✅ Created new page for exploration');
  }

  /**
   * Navigates to the initial URL and waits for page to be ready
   */
  private async navigateToInitialPage(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    // Ensure page is ready before navigation
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});

    console.log(`🌐 Navigating to ${url}...`);

    // Navigate with better waiting
    const response = await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    if (!response) {
      throw new Error('Navigation failed - no response');
    }

    console.log(`   📡 Response status: ${response.status()}`);

    // Wait for page to be fully interactive
    await PageLoader.waitForPageReady(this.page);

    // Wait for JavaScript to render content
    await PageLoader.waitForInteractiveContent(this.page);

    // Log page state for debugging
    await PageStateLogger.logPageState(this.page);

    // Verify we're on the correct domain
    const currentOrigin = new URL(this.page.url()).origin;
    if (currentOrigin !== this.baseUrl) {
      throw new Error(`Initial navigation left domain. Expected ${this.baseUrl}, got ${currentOrigin}`);
    }

    // Normalize and store initial URL
    const normalizedInitial = UrlNormalizer.normalize(this.initialUrl);
    this.visitedUrls.add(normalizedInitial);
  }

  /**
   * Analyzes the initial page and stores page info
   */
  private async analyzeInitialPage(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    console.log('📊 Analyzing initial page...');
    const initialPageInfo = await PageAnalyzer.analyzePage(this.page);
    this.allPageInfo.push(initialPageInfo);
    console.log(
      `✅ Found ${initialPageInfo.buttons.length} buttons, ${initialPageInfo.links.length} links, ${initialPageInfo.inputs.length} inputs`
    );

    // If no elements found, try retry
    if (initialPageInfo.buttons.length === 0 && initialPageInfo.links.length === 0 && initialPageInfo.inputs.length === 0) {
      console.log('⚠️  No elements found with standard detection. Trying retry...');
      await this.page.waitForTimeout(3000);
      const retryPageInfo = await PageAnalyzer.analyzePage(this.page);
      console.log(
        `   Retry: Found ${retryPageInfo.buttons.length} buttons, ${retryPageInfo.links.length} links, ${retryPageInfo.inputs.length} inputs`
      );
      if (retryPageInfo.buttons.length > 0 || retryPageInfo.links.length > 0 || retryPageInfo.inputs.length > 0) {
        this.allPageInfo[0] = retryPageInfo;
      }
    }
  }

  /**
   * Runs the main exploration loop, clicking elements until target navigations are reached
   */
  private async runExplorationLoop(maxNavigations: number): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    let navigationCount = 0;
    let totalClicks = 0;
    const maxClicks = PLANNER_CONFIG.MAX_CLICKS;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = PLANNER_CONFIG.MAX_CONSECUTIVE_FAILURES;

    console.log(`\n🎯 Starting exploration loop (target: ${maxNavigations} navigations, max clicks: ${maxClicks})...\n`);

    while (navigationCount < maxNavigations && totalClicks < maxClicks) {
      // Check if operation was cancelled
      if (this.abortSignal?.aborted) {
        console.log(`\n⏹️  Exploration cancelled by user`);
        throw new Error('Exploration cancelled');
      }

      const urlBefore = this.page.url();
      const normalizedUrlBefore = UrlNormalizer.normalize(urlBefore);

      console.log(`\n[Click ${totalClicks + 1}/${maxClicks}] Current URL: ${urlBefore}`);
      console.log(`   Navigations so far: ${navigationCount}/${maxNavigations}`);

      // Try to interact with the page
      await this.interactAndNavigate(this.page);

      totalClicks++;

      // Check if operation was cancelled before waiting
      if (this.abortSignal?.aborted) {
        console.log(`\n⏹️  Exploration cancelled by user`);
        throw new Error('Exploration cancelled');
      }

      // Wait for navigation to complete
      await PageLoader.waitForNavigation(this.page);

      // Check again after navigation
      if (this.abortSignal?.aborted) {
        console.log(`\n⏹️  Exploration cancelled by user`);
        throw new Error('Exploration cancelled');
      }

      // Verify we're still on the same domain
      await this.navigationManager.ensureSameDomain(this.page);

      // Check if we navigated to a new page
      const navigated = this.checkNavigation(urlBefore, this.page.url());
      if (navigated.isNewPage) {
        navigationCount++;
        this.visitedUrls.add(navigated.urlKey);
        console.log(`   ✅ Navigated to new page! (${navigationCount}/${maxNavigations})`);
        if (navigated.isHashChange) {
          console.log(`   📍 Hash navigation: ${navigated.hashBefore || '(none)'} → ${navigated.hashAfter}`);
        }

        // Analyze the new page
        const pageInfo = await PageAnalyzer.analyzePage(this.page);
        this.allPageInfo.push(pageInfo);
        console.log(`   📊 Page has ${pageInfo.buttons.length} buttons, ${pageInfo.links.length} links`);

        consecutiveFailures = 0;

        // Stop if we've reached the target
        if (navigationCount >= maxNavigations) {
          console.log(`\n🎯 Reached target of ${maxNavigations} navigations!`);
          break;
        }
      } else {
        console.log(navigated.isVisited ? `   ⚠️  Navigated to already visited page` : `   ⚠️  No navigation (URL unchanged)`);
        consecutiveFailures++;
      }

      // If we've failed to navigate multiple times, try to force navigate
      if (consecutiveFailures >= maxConsecutiveFailures) {
        const foundNewLink = await this.navigationManager.forceNavigateToNewPage(this.page, this.visitedUrls);
        if (foundNewLink) {
          await this.page.waitForTimeout(500);
          await this.navigationManager.ensureSameDomain(this.page);

          const newUrl = this.page.url();
          const normalizedNewUrl = UrlNormalizer.normalize(newUrl);

          if (!this.visitedUrls.has(normalizedNewUrl)) {
            navigationCount++;
            this.visitedUrls.add(normalizedNewUrl);

            const pageInfo = await PageAnalyzer.analyzePage(this.page);
            this.allPageInfo.push(pageInfo);

            consecutiveFailures = 0;

            if (navigationCount >= maxNavigations) {
              break;
            }
          }
        } else {
          break;
        }
      }
    }

    // Exploration complete
    if (this.tts) {
      const pagesExplored = this.allPageInfo.length;
      await this.tts.speak(`Done! Explored ${pagesExplored} page${pagesExplored !== 1 ? 's' : ''}`, 'realizing');
    }
  }

  /**
   * Checks if navigation occurred and returns navigation details
   */
  private checkNavigation(urlBefore: string, urlAfter: string): {
    isNewPage: boolean;
    isVisited: boolean;
    isHashChange: boolean;
    urlKey: string;
    hashBefore?: string;
    hashAfter?: string;
  } {
    const normalizedUrlBefore = UrlNormalizer.normalize(urlBefore);
    const normalizedUrlAfter = UrlNormalizer.normalize(urlAfter);

    // Check for hash changes (SPA routing)
    const hashBefore = new URL(urlBefore).hash;
    const hashAfter = new URL(urlAfter).hash;
    const hashChanged = hashBefore !== hashAfter;

    // Check if we navigated to a new page
    if (normalizedUrlAfter !== normalizedUrlBefore || hashChanged) {
      // For hash changes, create a unique key that includes the hash
      const urlKey =
        hashChanged && normalizedUrlAfter === normalizedUrlBefore
          ? `${normalizedUrlAfter}#${hashAfter}`
          : normalizedUrlAfter;

      const isVisited = this.visitedUrls.has(urlKey);

      return {
        isNewPage: !isVisited,
        isVisited,
        isHashChange: hashChanged && normalizedUrlAfter === normalizedUrlBefore,
        urlKey,
        hashBefore,
        hashAfter,
      };
    }

    return {
      isNewPage: false,
      isVisited: false,
      isHashChange: false,
      urlKey: normalizedUrlAfter,
    };
  }

  /**
   * Interacts with the page and attempts navigation
   */
  private async interactAndNavigate(page: Page): Promise<boolean> {
    // Check if operation was cancelled
    if (this.abortSignal?.aborted) {
      throw new Error('Exploration cancelled');
    }

    try {
      // Handle cookie popups
      await CookieHandler.handleCookiePopup(page);
      
      // Check again after cookie handling
      if (this.abortSignal?.aborted) {
        throw new Error('Exploration cancelled');
      }
      
      await page.waitForTimeout(500);

      // Find interactive elements
      console.log(`   🔍 Scanning for interactive elements...`);
      const interactiveElements = await ElementDetector.findInteractiveElements(page, this.baseUrl);
      console.log(`   📋 Found ${interactiveElements.length} interactive elements`);

      // If no elements found, wait longer and try again
      if (interactiveElements.length === 0) {
        return await this.retryElementDetection(page);
      }

      // Speak when elements are found
      if (this.tts) {
        await this.tts.speakAnalysis(interactiveElements.length, page.url());
      }

      // Select the best element to interact with
      // Ensure decisionMaker is initialized
      if (!this.decisionMaker) {
        this.decisionMaker = new DecisionMaker(this.personality);
      }
      const selection = await ElementSelector.selectElement(
        page,
        interactiveElements,
        this.useAI,
        this.decisionMaker,
        this.visitedUrls,
        this.currentMaxNavigations,
        this.interactionTracker,
        this.initialUrl
      );

      // Record interaction
      this.interactionTracker.rememberInteraction(selection.element, PLANNER_CONFIG.RECENT_INTERACTION_HISTORY_SIZE);

      // Log selection
      this.logElementSelection(page, interactiveElements, selection);

      // Speak the decision
      if (this.tts) {
        const elementName = (selection.element.text || selection.element.selector || 'element').substring(0, 25);
        await this.tts.speakAction(elementName);
      }

      // Verify element exists before attempting click
      const elementExists = await InteractionHandler.verifyElementExists(page, selection.element);
      if (!elementExists) {
        console.log(`   ⚠️  Element verification failed, but attempting click anyway...`);
      }

      // Interact with the element
      return await InteractionHandler.interactWithElement(page, selection.element);
    } catch (error) {
      console.log(`   ❌ Interaction failed: ${error}`);
      return false;
    }
  }

  /**
   * Retries element detection with longer waits
   */
  private async retryElementDetection(page: Page): Promise<boolean> {
    console.log(`   ⏳ No elements found, waiting longer for page to load...`);
    await page.waitForTimeout(3000);
    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    } catch {
      // Ignore
    }
    const retryElements = await ElementDetector.findInteractiveElements(page, this.baseUrl);
    console.log(`   🔄 Retry found ${retryElements.length} elements`);
    if (retryElements.length > 0) {
      const selectedElement = retryElements[0];
      console.log(`   📍 Clicking: ${selectedElement.type} "${selectedElement.text || selectedElement.selector}"`);
      return await InteractionHandler.interactWithElement(page, selectedElement);
    }
    console.log(`   ❌ Still no elements found after retry`);
    return false;
  }

  /**
   * Logs element selection information
   */
  private logElementSelection(page: Page, interactiveElements: InteractiveElement[], selection: ElementSelectionResult): void {
    const currentUrl = UrlNormalizer.normalize(page.url());
    console.log(`\n📍 ${currentUrl}`);
    console.log(`   ${interactiveElements.length} elements available → Clicking: ${selection.element.type} "${selection.element.text || selection.element.selector}"`);
    if (selection.element.isLink && selection.element.href) {
      console.log(`   🔗 Target URL: ${selection.element.href}`);
    }
    console.log(`   Selection method: ${selection.method}`);
  }

  /**
   * Generates the test plan from collected page information
   */
  private generateTestPlan(url: string, seedTestPath?: string): TestPlan {
    const overview = TestPlanGenerator.generateOverview(this.allPageInfo);
    const scenarios = TestPlanGenerator.generateScenarios(this.allPageInfo, url, seedTestPath);

    if (this.tts) {
      this.tts.speak(`Creating test plan with ${scenarios.length} scenarios`, 'deciding').catch(() => {});
    }

    return {
      title: `${this.allPageInfo[0]?.title || 'Application'} Test Plan`,
      overview,
      scenarios,
    };
  }

  /**
   * Saves the test plan to a Markdown file
   */
  async saveMarkdown(plan: TestPlan, outputPath: string): Promise<void> {
    await MarkdownExporter.saveMarkdown(plan, outputPath);

    if (this.tts) {
      await this.tts.speak('Test plan saved!', 'acting');
    }
  }

  /**
   * Cleans up browser resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

// Re-export types for convenience
export type { TestPlan, TestScenario } from './types.js';

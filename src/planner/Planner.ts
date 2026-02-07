import { chromium, Browser, Page } from '@playwright/test';
import { DecisionMaker, type InteractiveElement, type PageContext } from '../ai/DecisionMaker.js';
import { TestPlan, TestScenario, PageInfo } from './types.js';
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
  private decisionMaker: DecisionMaker = new DecisionMaker();
  private useAI: boolean = false;
  private currentMaxNavigations: number = 3;
  private interactionTracker: InteractionTracker = new InteractionTracker();
  private navigationManager!: NavigationManager;
  private tts: TTS | null = null;

  /**
   * Prints a nice boxed configuration display
   */
  private printConfigBox(aiProvider: string | null, aiModel: string | null, ttsInfo: { provider: string; model?: string; voice?: string } | null) {
    const width = 60;
    const topBorder = '╔' + '═'.repeat(width - 2) + '╗';
    const bottomBorder = '╚' + '═'.repeat(width - 2) + '╝';
    const sideBorder = '║';
    const emptyLine = sideBorder + ' '.repeat(width - 2) + sideBorder;

    console.log('\n' + chalk.cyan(topBorder));
    console.log(chalk.cyan(sideBorder) + chalk.bold.white('  🤖 Planner Configuration'.padEnd(width - 3)) + chalk.cyan(sideBorder));
    console.log(chalk.cyan(emptyLine));

    // AI Decision Making
    if (aiProvider === 'heuristic') {
      const line = `  Decision Making: ${chalk.bold.yellow('Heuristics (AI disabled)')}`;
      console.log(chalk.cyan(sideBorder) + line.padEnd(width - 3) + chalk.cyan(sideBorder));
    } else if (aiProvider && aiModel) {
      const providerName = aiProvider === 'ollama' ? 'Ollama' : 
                          aiProvider === 'openai' ? 'OpenAI' : 
                          aiProvider === 'anthropic' ? 'Anthropic' : aiProvider;
      const line = `  Decision Making: ${chalk.bold.green(providerName)} (${chalk.yellow(aiModel)})`;
      console.log(chalk.cyan(sideBorder) + line.padEnd(width - 3) + chalk.cyan(sideBorder));
    } else {
      const line = `  Decision Making: ${chalk.dim('Heuristics (AI not available)')}`;
      console.log(chalk.cyan(sideBorder) + line.padEnd(width - 3) + chalk.cyan(sideBorder));
    }

    // TTS
    if (ttsInfo) {
      let ttsLine = `  Text-to-Speech: ${chalk.bold.green(ttsInfo.provider === 'openai' ? 'OpenAI' : ttsInfo.provider === 'piper' ? 'Piper' : 'macOS')}`;
      if (ttsInfo.provider === 'openai' && ttsInfo.model && ttsInfo.voice) {
        ttsLine += ` (${chalk.yellow(ttsInfo.model)} / ${chalk.yellow(ttsInfo.voice)})`;
      } else if (ttsInfo.provider === 'piper' && ttsInfo.voice) {
        ttsLine += ` (${chalk.yellow(ttsInfo.voice)})`;
      } else if (ttsInfo.provider === 'macos' && ttsInfo.voice) {
        ttsLine += ` (${chalk.yellow(ttsInfo.voice)})`;
      }
      console.log(chalk.cyan(sideBorder) + ttsLine.padEnd(width - 3) + chalk.cyan(sideBorder));
    } else {
      const line = `  Text-to-Speech: ${chalk.dim('Disabled')}`;
      console.log(chalk.cyan(sideBorder) + line.padEnd(width - 3) + chalk.cyan(sideBorder));
    }

    console.log(chalk.cyan(bottomBorder) + '\n');
  }

  async initialize(useAI: boolean = false, enableTTS: boolean = false) {
    // Only launch browser if it doesn't exist
    if (!this.browser) {
      console.log('🔧 Initializing browser...');
      this.browser = await chromium.launch({ 
        headless: false,
        args: ['--disable-blink-features=AutomationControlled'] // Make browser less detectable
      });
      console.log('✅ Browser launched');
    }
    
    // Note: We don't create a page here anymore - it will be created in explore()
    // This allows explore() to create a fresh page for each exploration
    this.decisionMaker = new DecisionMaker();
    this.useAI = useAI && this.decisionMaker.isEnabled();
    
    // Get AI provider and model info (always get provider, even if disabled)
    let aiProvider: string | null = this.decisionMaker.getProvider();
    let aiModel: string | null = null;
    if (this.useAI && aiProvider !== 'heuristic') {
      aiModel = this.decisionMaker.getModel();
    }
    
    // Initialize TTS if enabled and get info
    let ttsInfo: { provider: string; model?: string; voice?: string } | null = null;
    if (enableTTS) {
      this.tts = new TTS(true);
      ttsInfo = await this.tts.getProviderInfo();
    }
    
    // Print nice configuration box
    this.printConfigBox(aiProvider, aiModel, ttsInfo);
    
    if (useAI && !this.decisionMaker.isEnabled()) {
      console.log(chalk.yellow('⚠️  AI requested but not available. For Ollama, make sure it\'s running: ollama serve'));
      console.log(chalk.dim('   "No worries, I\'ll use my trusty heuristics instead. They\'re pretty good too!"'));
    }
  }

  async explore(url: string, seedTestPath?: string, maxNavigations: number = 3, useAI: boolean = false, enableTTS: boolean = false): Promise<TestPlan> {
    // Store the base origin (domain) - this is what we'll enforce
    const initialUrlObj = new URL(url);
    this.baseUrl = initialUrlObj.origin;
    this.visitedUrls.clear();
    this.allPageInfo = [];
    this.initialUrl = url.split('#')[0].replace(/\/$/, '');
    this.currentMaxNavigations = maxNavigations;
    this.navigationManager = new NavigationManager(this.baseUrl, this.initialUrl);
    this.interactionTracker.clear();

    // Initialize browser if needed (but don't create page yet)
    if (!this.browser) {
      await this.initialize(useAI, enableTTS);
    } else {
      // Update AI/TTS settings if needed
      if (useAI && !this.useAI) {
        this.decisionMaker = new DecisionMaker();
        this.useAI = this.decisionMaker.isEnabled();
      } else if (enableTTS && !this.tts) {
        this.tts = new TTS(true);
      }
    }
    
    // Always create a fresh context and page for each exploration
    // Close existing page and context if they exist
    if (this.page) {
      try {
        const oldContext = this.page.context();
        await this.page.close();
        await oldContext.close().catch(() => {}); // Close context too
      } catch {
        // Page/context might already be closed
      }
    }
    
    // Create a new context with cookie init script
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    // Set cookiesOptin cookie via JavaScript before any page loads
    await context.addInitScript(() => {
      document.cookie = 'cookiesOptin=true; path=/; SameSite=Lax';
    });
    
    // Create a new page
    this.page = await context.newPage();
    
    // Navigate to about:blank first to ensure page is ready
    await this.page.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await this.page.waitForTimeout(100);
    
    console.log('✅ Created new page for exploration');
    
    if (useAI && !this.useAI) {
      this.decisionMaker = new DecisionMaker();
      this.useAI = this.decisionMaker.isEnabled();
    } else if (enableTTS && !this.tts) {
      this.tts = new TTS(true);
    }

    try {
      // Start from the initial URL (cookie is set via addInitScript)
      if (!this.page) {
        throw new Error('Page not initialized');
      }
      
      // Ensure page is ready before navigation
      await this.page.waitForLoadState('domcontentloaded').catch(() => {});
      
      console.log(`🌐 Navigating to ${url}...`);
      
      // Navigate with better waiting
      const response = await this.page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      
      if (!response) {
        throw new Error('Navigation failed - no response');
      }
      
      console.log(`   📡 Response status: ${response.status()}`);
      
      // Wait for page to be fully interactive
      console.log('⏳ Waiting for page to settle...');
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      } catch {
        // Ignore networkidle timeout
      }
      
      // Wait for body to have content
      try {
        await this.page.waitForFunction(
          () => document.body && document.body.children.length > 0,
          { timeout: 10000 }
        ).catch(() => {});
      } catch {
        // Ignore if body check fails
      }
      
      await this.page.waitForTimeout(3000); // Give extra time for JS to render
      console.log(`✅ Loaded page: ${this.page.url()}`);
      
      // Wait for JavaScript to render content - try waiting for specific elements or network idle
      console.log('⏳ Waiting for JavaScript to render content...');
      
      // Try waiting for common interactive elements to appear
      try {
        await Promise.race([
          this.page.waitForSelector('a[href]', { timeout: 10000 }).catch(() => {}),
          this.page.waitForSelector('button', { timeout: 10000 }).catch(() => {}),
          this.page.waitForSelector('[role="button"]', { timeout: 10000 }).catch(() => {}),
          this.page.waitForSelector('[role="link"]', { timeout: 10000 }).catch(() => {}),
          this.page.waitForTimeout(10000) // Max wait
        ]);
      } catch {
        // Ignore
      }
      
      // Wait for network to be completely idle
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      } catch {
        // Ignore
      }
      
      // Additional wait for JavaScript frameworks
      await this.page.waitForTimeout(2000);
      
      // Debug: Check page state - with error handling
      let pageState: any = null;
      try {
        pageState = await this.page.evaluate(() => {
          // Check for shadow DOM elements
          const shadowElements: string[] = [];
          const allElements = document.querySelectorAll('*');
          allElements.forEach((el) => {
            if (el.shadowRoot) {
              shadowElements.push(el.tagName.toLowerCase());
            }
          });
          
          return {
            bodyExists: !!document.body,
            bodyChildren: document.body?.children.length || 0,
            totalElements: document.querySelectorAll('*').length,
            links: document.querySelectorAll('a[href]').length,
            buttons: document.querySelectorAll('button, [role="button"]').length,
            readyState: document.readyState,
            hasIframes: document.querySelectorAll('iframe').length > 0,
            title: document.title,
            bodyText: document.body?.textContent?.substring(0, 100) || '',
            shadowRoots: shadowElements.length,
            shadowRootTags: shadowElements.slice(0, 5),
            // Check for common web component patterns
            customElements: Array.from(document.querySelectorAll('*')).filter(el => 
              el.tagName.includes('-') || el.shadowRoot
            ).map(el => el.tagName.toLowerCase()).slice(0, 10)
          };
        });
        console.log(`   📊 Page state: ${pageState.bodyChildren} body children, ${pageState.totalElements} total elements, ${pageState.links} links, ${pageState.buttons} buttons`);
        console.log(`   📄 Ready state: ${pageState.readyState}, Has iframes: ${pageState.hasIframes}`);
        console.log(`   📝 Title: ${pageState.title}`);
        console.log(`   📄 Body preview: ${pageState.bodyText}...`);
        if (pageState.shadowRoots > 0) {
          console.log(`   🔍 Found ${pageState.shadowRoots} shadow DOM elements: ${pageState.shadowRootTags.join(', ')}`);
        }
        if (pageState.customElements.length > 0) {
          console.log(`   🧩 Found custom elements: ${pageState.customElements.join(', ')}`);
        }
      } catch (evalError: any) {
        console.log(`   ❌ Failed to evaluate page state: ${evalError.message}`);
        console.log(`   ⚠️  This might indicate the page is not accessible or blocked`);
      }
      
      // Verify we're on the correct domain
      const currentOrigin = new URL(this.page!.url()).origin;
      if (currentOrigin !== this.baseUrl) {
        throw new Error(`Initial navigation left domain. Expected ${this.baseUrl}, got ${currentOrigin}`);
      }
      
      // Normalize and store initial URL
      const normalizedInitial = UrlNormalizer.normalize(this.initialUrl);
      this.visitedUrls.add(normalizedInitial);

      // Analyze the initial page
      console.log('📊 Analyzing initial page...');
      const initialPageInfo = await PageAnalyzer.analyzePage(this.page!);
      this.allPageInfo.push(initialPageInfo);
      console.log(`✅ Found ${initialPageInfo.buttons.length} buttons, ${initialPageInfo.links.length} links, ${initialPageInfo.inputs.length} inputs`);
      
      // If no elements found, try to find them with a more permissive approach
      if (initialPageInfo.buttons.length === 0 && initialPageInfo.links.length === 0 && initialPageInfo.inputs.length === 0) {
        console.log('⚠️  No elements found with standard detection. Trying fallback detection...');
        const fallbackElements = await this.getFallbackElements(this.page!);
        console.log(`   Found ${fallbackElements.length} fallback elements`);
        
        if (fallbackElements.length === 0) {
          console.log('❌ No interactive elements found on page. The page may still be loading or has no clickable elements.');
          // Try waiting a bit more and checking again
          await this.page.waitForTimeout(3000);
          const retryPageInfo = await PageAnalyzer.analyzePage(this.page!);
          console.log(`   Retry: Found ${retryPageInfo.buttons.length} buttons, ${retryPageInfo.links.length} links, ${retryPageInfo.inputs.length} inputs`);
          if (retryPageInfo.buttons.length > 0 || retryPageInfo.links.length > 0 || retryPageInfo.inputs.length > 0) {
            // Update with retry results
            this.allPageInfo[0] = retryPageInfo;
          }
        }
      }

      // Start interactive exploration
      let navigationCount = 0;
      let totalClicks = 0;
      const maxClicks = PLANNER_CONFIG.MAX_CLICKS;
      let consecutiveFailures = 0;
      const maxConsecutiveFailures = PLANNER_CONFIG.MAX_CONSECUTIVE_FAILURES;

      // Keep clicking until we reach target navigations or hit max clicks
      console.log(`\n🎯 Starting exploration loop (target: ${maxNavigations} navigations, max clicks: ${maxClicks})...\n`);
      while (navigationCount < maxNavigations && totalClicks < maxClicks) {
        const urlBefore = this.page!.url();
        const normalizedUrlBefore = UrlNormalizer.normalize(urlBefore);
        
        console.log(`\n[Click ${totalClicks + 1}/${maxClicks}] Current URL: ${urlBefore}`);
        console.log(`   Navigations so far: ${navigationCount}/${maxNavigations}`);
        
        // Try to interact with the page (click buttons, fill inputs, click links)
        const navigated = await this.interactAndNavigate(this.page!);
        
        totalClicks++;
        
        // Wait for navigation to complete and page to settle
        await this.page!.waitForTimeout(1000);
        
        // Also wait for network to be idle (for SPAs)
        try {
          await this.page!.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
        } catch {
          // Ignore networkidle timeout
        }
        
        // CRITICAL: Verify we're still on the same domain
        await this.navigationManager.ensureSameDomain(this.page!);
        
        const urlAfter = this.page!.url();
        const normalizedUrlAfter = UrlNormalizer.normalize(urlAfter);
        
        // Also check for hash changes (SPA routing)
        const hashBefore = new URL(urlBefore).hash;
        const hashAfter = new URL(urlAfter).hash;
        const hashChanged = hashBefore !== hashAfter;
        
        // Check if we navigated to a new page (URL changed and not already visited)
        if (normalizedUrlAfter !== normalizedUrlBefore || hashChanged) {
          // For hash changes, create a unique key that includes the hash
          const urlKey = hashChanged && normalizedUrlAfter === normalizedUrlBefore
            ? `${normalizedUrlAfter}#${hashAfter}`
            : normalizedUrlAfter;
          
          if (!this.visitedUrls.has(urlKey)) {
            navigationCount++;
            this.visitedUrls.add(urlKey);
            console.log(`   ✅ Navigated to new page! (${navigationCount}/${maxNavigations})`);
            if (hashChanged && normalizedUrlAfter === normalizedUrlBefore) {
              console.log(`   📍 Hash navigation: ${hashBefore || '(none)'} → ${hashAfter}`);
            }
            
            // Analyze the new page
            const pageInfo = await PageAnalyzer.analyzePage(this.page!);
            this.allPageInfo.push(pageInfo);
            console.log(`   📊 Page has ${pageInfo.buttons.length} buttons, ${pageInfo.links.length} links`);
            
            consecutiveFailures = 0;
            
            // Stop if we've reached the target
            if (navigationCount >= maxNavigations) {
              console.log(`\n🎯 Reached target of ${maxNavigations} navigations!`);
              break;
            }
          } else {
            console.log(`   ⚠️  Navigated to already visited page`);
            consecutiveFailures++;
          }
        } else {
          console.log(`   ⚠️  No navigation (URL unchanged)`);
          consecutiveFailures++;
        }
        
        // If we've failed to navigate multiple times in a row, try to find a new link
        if (consecutiveFailures >= maxConsecutiveFailures) {
          const foundNewLink = await this.navigationManager.forceNavigateToNewPage(this.page!, this.visitedUrls);
          if (foundNewLink) {
            await this.page!.waitForTimeout(500);
            await this.navigationManager.ensureSameDomain(this.page!);
            
            const newUrl = this.page!.url();
            const normalizedNewUrl = UrlNormalizer.normalize(newUrl);
            
            if (!this.visitedUrls.has(normalizedNewUrl)) {
              navigationCount++;
              this.visitedUrls.add(normalizedNewUrl);
              
              const pageInfo = await PageAnalyzer.analyzePage(this.page!);
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
      
      // Generate test plan
      const overview = TestPlanGenerator.generateOverview(this.allPageInfo);
      const scenarios = TestPlanGenerator.generateScenarios(this.allPageInfo, url, seedTestPath);
      
      if (this.tts) {
        await this.tts.speak(`Creating test plan with ${scenarios.length} scenarios`, 'deciding');
      }
      
      return {
        title: `${this.allPageInfo[0]?.title || 'Application'} Test Plan`,
        overview,
        scenarios
      };
    } catch (error: any) {
      throw new Error(`Exploration failed: ${error.message}`);
    }
  }

  private async interactAndNavigate(page: Page): Promise<boolean> {
    try {
      // First, check for and handle cookie popups/modals
      await CookieHandler.handleCookiePopup(page);
      
      // Wait a bit for page to be ready
      await page.waitForTimeout(500);
      
      // Wait a bit for page to be ready before scanning
      await page.waitForTimeout(500);
      
      // Get ALL interactive elements on the current page (including shadow DOM)
      console.log(`   🔍 Scanning for interactive elements...`);
      const interactiveElements = await ElementDetector.findInteractiveElements(page, this.baseUrl);
      console.log(`   📋 Found ${interactiveElements.length} interactive elements`);
      
      // If no elements found, wait longer and try again
      if (interactiveElements.length === 0) {
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
          // Use the retry elements
          const selectedElement = retryElements[0];
          console.log(`   📍 Clicking: ${selectedElement.type} "${selectedElement.text || selectedElement.selector}"`);
          return await InteractionHandler.interactWithElement(page, selectedElement);
        }
        // Still no elements - return false
        console.log(`   ❌ Still no elements found after retry`);
        return false;
      }

      // Speak when elements are found (includes thinking message)
      if (this.tts) {
        await this.tts.speakAnalysis(interactiveElements.length, page.url());
      }

      if (interactiveElements.length === 0) {
        // Try fallback method
        const fallbackElements = await this.getFallbackElements(page);
        if (fallbackElements.length > 0) {
          const randomIndex = Math.floor(Math.random() * fallbackElements.length);
          const element = fallbackElements[randomIndex];
          return await InteractionHandler.interactWithElement(page, element);
        }
        return false;
      }

      // Select the best element to interact with (AI-powered or heuristic/random)
      let selectedIndex: number;
      let selectionMethod: string;
      let aiReasoning: string | undefined;
      
      if (this.useAI && interactiveElements.length > 0) {
        try {
          // Get page context for AI
          const pageContextData = await page.evaluate(() => {
            return {
              url: window.location.href,
              title: document.title,
              headings: Array.from(document.querySelectorAll('h1, h2, h3'))
                .slice(0, 5)
                .map((h: Element) => h.textContent?.trim() || '')
            };
          });
          
          // Limit elements shown to AI for faster processing
          // Randomly select a subset to give variety across runs
          const maxElementsToShow = PLANNER_CONFIG.MAX_ELEMENTS_TO_SHOW_AI;
          const shuffled = [...interactiveElements].sort(() => Math.random() - 0.5);
          const elementsForAI = shuffled.slice(0, maxElementsToShow);
          
          // Build context for AI (only with subset of elements for speed)
          const fullContext: PageContext = {
            url: pageContextData.url,
            title: pageContextData.title,
            headings: pageContextData.headings,
            elements: elementsForAI.map((el, idx) => ({
              ...el,
              index: idx
            })),
            visitedUrls: Array.from(this.visitedUrls),
            targetNavigations: this.currentMaxNavigations,
            currentNavigations: this.visitedUrls.size,
            recentInteractionKeys: this.interactionTracker.getRecentKeys(5) // Reduced from 20 to 5
          };
          
          // Skip verbose thinking - too chatty

          const recommendation = await this.decisionMaker.recommendBestInteraction(fullContext);
          
          if (recommendation) {
            // Skip speaking reasoning - only speak when elements found and when clicking
            // Guardrail: don't let AI spam the same element (especially Home)
            // Map AI index back to full array (AI only sees subset)
            const proposed = elementsForAI[recommendation.elementIndex];
            const proposedKey = this.interactionTracker.makeInteractionKey(proposed);
            const proposedText = (proposed.text || '').toLowerCase();
            const proposedHref = (proposed.href || '').split('#')[0].replace(/\/$/, '');
            const normalizedInitial = this.initialUrl ? this.initialUrl.split('#')[0].replace(/\/$/, '') : '';
            const isHomey =
              proposedText === 'home' ||
              proposedText.includes('home') ||
              (proposed.isLink && proposedHref === normalizedInitial);

            const blocked = new Set(this.interactionTracker.getRecentKeys(10));
            const isBlocked = blocked.has(proposedKey) || isHomey;

            if (isBlocked) {
              // Find alternative that's not blocked
              const candidateIndices = interactiveElements
                .map((el, idx) => ({ el, idx, key: this.interactionTracker.makeInteractionKey(el) }))
                .filter(({ el, key }) => {
                  if (blocked.has(key)) return false;
                  const text = (el.text || '').toLowerCase();
                  if (text === 'home' || text.includes('home')) return false;
                  if (el.isLink && el.href) {
                    const href = el.href.split('#')[0].replace(/\/$/, '');
                    if (this.visitedUrls.has(href)) return false;
                  }
                  return true;
                })
                .map(({ idx }) => idx);

              if (candidateIndices.length > 0) {
                selectedIndex = candidateIndices[0];
                selectionMethod = 'AI (de-duped)';
              } else {
                selectedIndex = DecisionMaker.selectBestElementHeuristic(interactiveElements, Array.from(this.visitedUrls));
                selectionMethod = 'heuristic (AI repeated)';
              }
            } else {
              // Find the proposed element in the full interactiveElements array
              // (since AI index is relative to the subset, not the full array)
              const proposedIndex = interactiveElements.findIndex(el => {
                // Match by href for links (most reliable)
                if (proposed.isLink && proposed.href && el.isLink && el.href) {
                  const proposedHrefNorm = proposed.href.split('#')[0].replace(/\/$/, '');
                  const elHrefNorm = el.href.split('#')[0].replace(/\/$/, '');
                  return proposedHrefNorm === elHrefNorm;
                }
                // Match by text if available
                if (proposed.text && el.text && proposed.text.trim() && el.text.trim()) {
                  return proposed.text.trim().toLowerCase() === el.text.trim().toLowerCase();
                }
                // Fallback to selector
                return proposed.selector === el.selector;
              });
              
              if (proposedIndex !== -1) {
                selectedIndex = proposedIndex;
                selectionMethod = 'AI';
              } else {
                // Fallback if we can't find the element in the full array
                selectedIndex = DecisionMaker.selectBestElementHeuristic(interactiveElements, Array.from(this.visitedUrls));
                selectionMethod = 'heuristic (element not found)';
              }
            }

            aiReasoning = recommendation.reasoning;
          } else {
            selectedIndex = DecisionMaker.selectBestElementHeuristic(interactiveElements, Array.from(this.visitedUrls));
            selectionMethod = 'heuristic (AI unavailable)';
          }
        } catch (error: any) {
          selectedIndex = DecisionMaker.selectBestElementHeuristic(interactiveElements, Array.from(this.visitedUrls));
          selectionMethod = 'heuristic (AI error)';
        }
      } else {
        selectedIndex = DecisionMaker.selectBestElementHeuristic(interactiveElements, Array.from(this.visitedUrls));
        selectionMethod = 'heuristic';
      }
      
      const element = interactiveElements[selectedIndex];
      // Record what we're about to do so we don't keep repeating it
      this.interactionTracker.rememberInteraction(element, PLANNER_CONFIG.RECENT_INTERACTION_HISTORY_SIZE);
      
      // Show focused output: URL, element count, and what we're clicking
      const currentUrl = UrlNormalizer.normalize(page.url());
      console.log(`\n📍 ${currentUrl}`);
      console.log(`   ${interactiveElements.length} elements available → Clicking: ${element.type} "${element.text || element.selector}"`);
      if (element.isLink && element.href) {
        console.log(`   🔗 Target URL: ${element.href}`);
      }
      console.log(`   Selection method: ${selectionMethod}`);
      
      // Speak the decision and action
      if (this.tts) {
        // Just speak the element name with dynamic action prefix
        const elementName = (element.text || element.selector || 'element').substring(0, 25);
        await this.tts.speakAction(elementName);
      }
      
      // Verify element exists before attempting click
      const elementExists = await InteractionHandler.verifyElementExists(page, element);
      
      if (!elementExists) {
        console.log(`   ⚠️  Element verification failed, but attempting click anyway...`);
      }

      // Interact with the element
      return await InteractionHandler.interactWithElement(page, element);
    } catch (error) {
      return false;
    }
  }

  private async getFallbackElements(page: Page): Promise<InteractiveElement[]> {
    const ignoredTags = PLANNER_CONFIG.IGNORED_TAGS.join(', ');
    const fallbackElements = await page.evaluate((args: { baseOrigin: string; ignoredTags: string }) => {
      const { baseOrigin, ignoredTags } = args;
      const elements: any[] = [];
      
      // Get all buttons (excluding ignored tags)
      Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'))
        .filter((el: Element) => (el as HTMLElement).closest(ignoredTags) === null)
        .forEach((el: Element) => {
          const element = el as HTMLElement;
          const text = (element.textContent || '').trim() || element.getAttribute('aria-label') || '';
          if (text.toLowerCase().includes('delete') && text.toLowerCase().includes('remove')) {
            return;
          }
          
          let selector = '';
          if (element.id) selector = `#${element.id}`;
          else if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c.length > 0);
            if (classes.length > 0) selector = `.${classes[0]}`;
          }
          if (!selector) selector = element.tagName.toLowerCase();
          
          elements.push({
            type: 'button',
            text: text,
            selector: selector,
            isLink: false
          });
        });
      
      // Get all links (excluding ignored tags)
      Array.from(document.querySelectorAll('a[href]'))
        .filter((el: Element) => (el as HTMLElement).closest(ignoredTags) === null)
        .forEach((el: Element) => {
          const anchor = el as HTMLAnchorElement;
          try {
            const url = new URL(anchor.href);
            if (url.origin === baseOrigin && !anchor.href.includes('#')) {
              let selector = '';
              if (anchor.id) selector = `#${anchor.id}`;
              else if (anchor.className && typeof anchor.className === 'string') {
                const classes = anchor.className.split(' ').filter(c => c.length > 0);
                if (classes.length > 0) selector = `.${classes[0]}`;
              }
              if (!selector) selector = `a[href="${anchor.href}"]`;
              
              elements.push({
                type: 'link',
                text: (anchor.textContent || '').trim() || anchor.getAttribute('aria-label') || '',
                href: anchor.href,
                selector: selector,
                isLink: true
              });
            }
          } catch {
            // Skip invalid links
          }
        });
      
      return elements;
    }, { baseOrigin: this.baseUrl, ignoredTags });

    return fallbackElements as InteractiveElement[];
  }

  async saveMarkdown(plan: TestPlan, outputPath: string) {
    await MarkdownExporter.saveMarkdown(plan, outputPath);
    
    if (this.tts) {
      await this.tts.speak('Test plan saved!', 'acting');
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

// Re-export types for convenience
export type { TestPlan, TestScenario } from './types.js';


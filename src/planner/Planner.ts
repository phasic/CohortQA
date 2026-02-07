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
    if (aiProvider && aiModel) {
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
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext();
    
    // Set cookiesOptin cookie via JavaScript before any page loads
    // This ensures the cookie is available before cookie consent popup logic runs
    await context.addInitScript(() => {
      // Set the cookie for the current domain
      document.cookie = 'cookiesOptin=true; path=/; SameSite=Lax';
    });
    
    this.page = await context.newPage();
    this.decisionMaker = new DecisionMaker();
    this.useAI = useAI && this.decisionMaker.isEnabled();
    
    // Get AI provider and model info
    let aiProvider: string | null = null;
    let aiModel: string | null = null;
    if (this.useAI) {
      aiProvider = this.decisionMaker.getProvider();
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

    if (!this.page) {
      await this.initialize(useAI, enableTTS);
    } else if (useAI && !this.useAI) {
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
      
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(500);
      
      // Verify we're on the correct domain
      const currentOrigin = new URL(this.page!.url()).origin;
      if (currentOrigin !== this.baseUrl) {
        throw new Error(`Initial navigation left domain. Expected ${this.baseUrl}, got ${currentOrigin}`);
      }
      
      // Normalize and store initial URL
      const normalizedInitial = UrlNormalizer.normalize(this.initialUrl);
      this.visitedUrls.add(normalizedInitial);

      // Analyze the initial page
      const initialPageInfo = await PageAnalyzer.analyzePage(this.page!);
      this.allPageInfo.push(initialPageInfo);

      // Start interactive exploration
      let navigationCount = 0;
      let totalClicks = 0;
      const maxClicks = PLANNER_CONFIG.MAX_CLICKS;
      let consecutiveFailures = 0;
      const maxConsecutiveFailures = PLANNER_CONFIG.MAX_CONSECUTIVE_FAILURES;

      // Keep clicking until we reach target navigations or hit max clicks
      while (navigationCount < maxNavigations && totalClicks < maxClicks) {
        const urlBefore = this.page!.url();
        const normalizedUrlBefore = UrlNormalizer.normalize(urlBefore);
        
        // Try to interact with the page (click buttons, fill inputs, click links)
        const navigated = await this.interactAndNavigate(this.page!);
        
        totalClicks++;
        
        // Wait for navigation to complete and page to settle
        await this.page!.waitForTimeout(1000);
        
        // CRITICAL: Verify we're still on the same domain
        await this.navigationManager.ensureSameDomain(this.page!);
        
        const urlAfter = this.page!.url();
        const normalizedUrlAfter = UrlNormalizer.normalize(urlAfter);
        
        // Check if we navigated to a new page (URL changed and not already visited)
        if (normalizedUrlAfter !== normalizedUrlBefore) {
          if (!this.visitedUrls.has(normalizedUrlAfter)) {
            navigationCount++;
            this.visitedUrls.add(normalizedUrlAfter);
            
            // Analyze the new page
            const pageInfo = await PageAnalyzer.analyzePage(this.page!);
            this.allPageInfo.push(pageInfo);
            
            consecutiveFailures = 0;
            
            // Stop if we've reached the target
            if (navigationCount >= maxNavigations) {
              break;
            }
          } else {
            consecutiveFailures++;
          }
        } else {
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
      
      // Get ALL interactive elements on the current page (including shadow DOM)
      const interactiveElements = await ElementDetector.findInteractiveElements(page, this.baseUrl);

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


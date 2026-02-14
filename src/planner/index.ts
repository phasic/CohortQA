import { loadConfig } from './config.js';
import { BrowserController } from './browser/BrowserController.js';
import { DOMScanner } from './scanner/DOMScanner.js';
import { ElementExtractor } from './extractor/ElementExtractor.js';
import { AIClient } from './ai/AIClient.js';
import { InteractionHandler } from './interaction/InteractionHandler.js';
import { NavigationTracker } from './tracker/NavigationTracker.js';
import { TestPlan, TestStep } from './types.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Formats elapsed time for display with blue color
 */
function formatTime(ms: number): string {
  const blue = '\x1b[34m';
  const reset = '\x1b[0m';
  const time = ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
  return `${blue}${time}${reset}`;
}

/**
 * Formats elapsed time without color (for table)
 */
function formatTimePlain(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Converts test plan to markdown format
 */
function testPlanToMarkdown(testPlan: TestPlan): string {
  const { metadata, steps } = testPlan;
  
  let md = `# Test Plan\n\n`;
  md += `**Start URL**: ${metadata.startUrl}\n\n`;
  
  // Steps to reproduce section
  md += `## Steps to Reproduce\n\n`;
  
  steps.forEach((step, index) => {
    // Skip initial navigate step if it's just the start URL
    if (step.action === 'navigate' && step.urlBefore === step.urlAfter && index === 0) {
      return;
    }
    
    md += `### Step ${step.stepNumber}: ${step.action.toUpperCase()}\n\n`;
    
    // Action details
    if (step.element) {
      md += `**Action:** ${step.action} on element\n`;
      
      // Include all available selectors for maximum flexibility in generator
      if (step.element.xpath) {
        md += `- **XPath**: \`${step.element.xpath}\`\n`;
      }
      if (step.element.selector) {
        md += `- **Selector**: \`${step.element.selector}\`\n`;
      }
      if (step.element.id) {
        md += `- **ID**: \`${step.element.id}\`\n`;
      }
      
      if (step.element.text) {
        md += `- **Text**: "${step.element.text}"\n`;
      }
      
      if (step.element.href) {
        md += `- **Link**: ${step.element.href}\n`;
      }
      
      if (step.value) {
        md += `- **Value**: \`${step.value}\`\n`;
      }
      
      md += `\n`;
    }
    
    // Expected results (only if navigation occurred)
    if (step.navigated) {
      md += `**Expected Results:**\n`;
      md += `- **URL**: ${step.urlAfter}\n`;
      
      if (step.pageTitle) {
        md += `- **Page Title**: "${step.pageTitle}"\n`;
      }
      
      if (step.keyElements && step.keyElements.length > 0) {
        md += `- **Key Elements**:\n`;
        step.keyElements.forEach((el) => {
          if (el.text) {
            md += `  - ${el.tag ? `<${el.tag}>` : 'Element'}: "${el.text}"`;
            if (el.id) {
              md += ` (id: \`${el.id}\`)`;
            }
            md += `\n`;
          }
        });
      }
      
      if (step.notableElements && step.notableElements.length > 0) {
        md += `- **Notable Elements**:\n`;
        step.notableElements.forEach((el) => {
          md += `  - `;
          if (el.selector) {
            md += `\`${el.selector}\``;
          } else if (el.id) {
            md += `#${el.id}`;
          } else if (el.tag) {
            md += `<${el.tag}>`;
          }
          if (el.text) {
            md += ` "${el.text}"`;
          }
          if (el.reason) {
            md += ` - ${el.reason}`;
          }
          md += `\n`;
        });
      }
      
      md += `\n`;
    }
    
    if (index < steps.length - 1) {
      md += `---\n\n`;
    }
  });
  
  return md;
}

/**
 * Strips ANSI color codes from a string
 */
function stripAnsiCodes(str: string): string {
  // Remove ANSI escape sequences (e.g., \x1b[34m, \x1b[0m, etc.)
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Gets the visual width of a string (excluding ANSI codes)
 */
function visualWidth(str: string): number {
  return stripAnsiCodes(str).length;
}

/**
 * Pads a string to a specific visual width, accounting for ANSI codes
 */
function padToWidth(str: string, width: number): string {
  const visualLen = visualWidth(str);
  const padding = Math.max(0, width - visualLen);
  return str + ' '.repeat(padding);
}

interface LoopSummary {
  loop: number;
  elementText: string;
  elementHref?: string;
  url: string;
  time: number;
}

async function main() {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('-u') + 1;
  const commandLineUrl = urlIndex > 0 ? args[urlIndex] : undefined;

  // Load configuration
  console.log('📋 Loading configuration...');
  const config = loadConfig();
  console.log('  ✅ Configuration loaded');

  // Determine starting URL: command line argument takes precedence, then config, then error
  const url = commandLineUrl || config.start_url;
  if (!url) {
    console.error('Usage: npm start -- -u <url> OR set start_url in config.yaml');
    process.exit(1);
  }

  // Initialize components
  const browserController = new BrowserController(config);
  const domScanner = new DOMScanner(config);
  const elementExtractor = new ElementExtractor(config);
  const aiClient = new AIClient(config);
  const interactionHandler = new InteractionHandler(config);
  const navigationTracker = new NavigationTracker();

  // Initialize test plan
  const testPlan: TestPlan = {
    metadata: {
      startUrl: url,
    },
    steps: [],
  };

  // Declare loopCount outside try block for error handling
  let loopCount = 0;

  try {
    // Step 1: Initialize browser
    await browserController.initialize();

    // Step 1: Navigate to initial URL
    await browserController.navigateTo(url);
    const startingUrl = browserController.getCurrentUrl();
    navigationTracker.trackNavigation(startingUrl);
    
    // Wait for initial page to settle before capturing elements
    const page = browserController.getPage();
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    } catch {
      // Continue even if load states timeout
    }
    // Additional wait for dynamic content
    await page.waitForTimeout(config.navigation.wait_after_navigation);
    
    // Capture page title and key elements for initial navigation
    const pageTitle = await page.evaluate(() => document.title).catch(() => '');
    
    // Get key elements (headings) for display
    const keyElements = await page.evaluate(() => {
      const keyElements: Array<{ tag?: string; text?: string; id?: string; selector?: string }> = [];
      const headings = document.querySelectorAll('h1, h2');
      headings.forEach((el, idx) => {
        if (idx < 5) {
          const text = el.textContent?.trim();
          if (text && text.length > 0 && text.length < 200) {
            keyElements.push({
              tag: el.tagName.toLowerCase(),
              text: text,
              id: el.id || undefined,
            });
          }
        }
      });
      return keyElements;
    }).catch(() => []);
    
    // Use DOMScanner to collect notable elements (reuses shadow DOM traversal)
    let initialNotableElements: Array<{ selector?: string; text?: string; tag?: string; id?: string; reason?: string }> | undefined;
    if (config.element_extraction.enable_notable_elements !== false) {
      const pageElements = await domScanner.collectNotableElements(page);
      
      // Use AI to identify notable elements for initial page
      if (pageElements && pageElements.length > 0) {
        console.log(`  📋 Found ${pageElements.length} page elements on initial page, identifying notable ones...`);
        initialNotableElements = await aiClient.identifyNotableElements(
          pageElements,
          pageTitle || 'Unknown',
          startingUrl
        );
      } else {
        console.log(`  ⚠️  No page elements found for notable element identification on initial page (pageElements: ${pageElements?.length || 0})`);
      }
    }
    
    // Add initial navigation step to test plan
    testPlan.steps.push({
      stepNumber: 1,
      action: 'navigate',
      urlBefore: url,
      urlAfter: startingUrl,
      navigated: true,
      timestamp: new Date().toISOString(),
      pageTitle: pageTitle,
      keyElements: keyElements,
      notableElements: initialNotableElements,
    });
    
    // Set starting domain for domain guardrail
    elementExtractor.setStartingDomain(startingUrl);
    
    // Set path restriction if configured
    elementExtractor.setStayOnPath();

    // Main loop
    const maxLoops = config.navigation.max_loops > 0 ? config.navigation.max_loops : Infinity;
    const loopSummaries: LoopSummary[] = [];
    
    while (
      !navigationTracker.hasReachedMax(config.navigation.max_navigations) &&
      loopCount < maxLoops
    ) {
      loopCount++;
      const loopStartTime = performance.now();
      const loopStartUrl = browserController.getCurrentUrl();
      console.log('\n' + '='.repeat(60));
      const navInfo = `Navigations: ${navigationTracker.getNavigationCount()}/${config.navigation.max_navigations}`;
      const loopInfo = config.navigation.max_loops > 0 
        ? `Loops: ${loopCount}/${config.navigation.max_loops}`
        : `Loops: ${loopCount}`;
      console.log(`🔄 Loop iteration ${loopCount} (${navInfo}, ${loopInfo})`);
      console.log('='.repeat(60));

      // Step 2: Scan DOM (including shadow DOM)
      const page = browserController.getPage();
      const allElements = await domScanner.scanDOM(page);

      if (allElements.length === 0) {
        const loopElapsedTime = performance.now() - loopStartTime;
        console.log(`\n  ⏱️  Total loop time: ${formatTime(loopElapsedTime)}`);
        console.log('  ⚠️  No interactable elements found. Stopping.');
        loopSummaries.push({
          loop: loopCount,
          elementText: 'No elements found',
          url: browserController.getCurrentUrl(),
          time: loopElapsedTime
        });
        break;
      }

      // Step 3: Extract interactable elements with guardrails
      const currentUrl = browserController.getCurrentUrl();
      const visitedUrls = navigationTracker.getVisitedUrls();
      const elements = elementExtractor.extract(allElements, currentUrl, visitedUrls);

      if (elements.length === 0) {
        const loopElapsedTime = performance.now() - loopStartTime;
        console.log(`\n  ⏱️  Total loop time: ${formatTime(loopElapsedTime)}`);
        console.log('  ⚠️  No elements passed guardrails. Stopping.');
        loopSummaries.push({
          loop: loopCount,
          elementText: 'No elements passed guardrails',
          url: browserController.getCurrentUrl(),
          time: loopElapsedTime
        });
        break;
      }

      // Step 4: Feed to AI model
      const aiResponse = await aiClient.selectElement(elements, visitedUrls);

      // Validate AI response
      if (aiResponse.elementIndex < 0 || aiResponse.elementIndex >= elements.length) {
        const loopElapsedTime = performance.now() - loopStartTime;
        console.error(`  ❌ Invalid element index from AI: ${aiResponse.elementIndex}`);
        console.log(`\n  ⏱️  Total loop time: ${formatTime(loopElapsedTime)}`);
        loopSummaries.push({
          loop: loopCount,
          elementText: `Invalid AI response (index: ${aiResponse.elementIndex})`,
          url: browserController.getCurrentUrl(),
          time: loopElapsedTime
        });
        break;
      }

      const selectedElement = elements[aiResponse.elementIndex];
      
      // Get additional element context from the browser
      const elementContext = await page.evaluate((selector: string) => {
        const el = document.querySelector(selector) as HTMLElement;
        if (!el) return null;
        
        // Get parent chain
        const parentChain: string[] = [];
        let current: HTMLElement | null = el.parentElement;
        let depth = 0;
        while (current && depth < 5) {
          const parentInfo = current.tagName.toLowerCase();
          if (current.id) {
            parentChain.push(`${parentInfo}#${current.id}`);
          } else if (current.className && typeof current.className === 'string') {
            const classes = current.className.split(' ').filter(c => c).slice(0, 2).join('.');
            if (classes) {
              parentChain.push(`${parentInfo}.${classes}`);
            } else {
              parentChain.push(parentInfo);
            }
          } else {
            parentChain.push(parentInfo);
          }
          current = current.parentElement;
          depth++;
        }
        
        // Generate XPath
        const getXPath = (element: HTMLElement): string => {
          if (element.id) {
            return `//*[@id="${element.id}"]`;
          }
          const parts: string[] = [];
          let current: HTMLElement | null = element;
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            const tagName = current.tagName.toLowerCase();
            if (current.parentElement) {
              const siblings = Array.from(current.parentElement.children);
              const sameTagSiblings = siblings.filter(s => s.tagName.toLowerCase() === tagName);
              if (sameTagSiblings.length > 1) {
                index = sameTagSiblings.indexOf(current) + 1;
                parts.unshift(`${tagName}[${index}]`);
              } else {
                parts.unshift(tagName);
              }
            } else {
              parts.unshift(tagName);
            }
            current = current.parentElement;
            if (current === document.body || current === document.documentElement) break;
          }
          return '/' + parts.join('/');
        };
        
        return {
          xpath: getXPath(el),
          parentChain: parentChain.reverse().join(' > '),
          isInViewport: el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().bottom <= window.innerHeight
        };
      }, selectedElement.selector).catch(() => null);
      
      const elementDetails: string[] = [];
      elementDetails.push(`tag: ${selectedElement.tag}`);
      if (selectedElement.selector) {
        elementDetails.push(`selector: ${selectedElement.selector}`);
      }
      if (elementContext?.xpath) {
        elementDetails.push(`xpath: ${elementContext.xpath}`);
      }
      if (selectedElement.href) {
        elementDetails.push(`href: ${selectedElement.href}`);
      }
      if (selectedElement.id) {
        elementDetails.push(`id: ${selectedElement.id}`);
      }
      if (selectedElement.className) {
        elementDetails.push(`class: ${selectedElement.className.substring(0, 50)}`);
      }
      if (elementContext?.parentChain) {
        elementDetails.push(`parent: ${elementContext.parentChain}`);
      }
      if (selectedElement.boundingBox) {
        elementDetails.push(`position: (${Math.round(selectedElement.boundingBox.x)}, ${Math.round(selectedElement.boundingBox.y)}) size: ${Math.round(selectedElement.boundingBox.width)}x${Math.round(selectedElement.boundingBox.height)}`);
      }
      if (elementContext?.isInViewport !== undefined) {
        elementDetails.push(`in viewport: ${elementContext.isInViewport ? 'yes' : 'no'}`);
      }
      
      console.log(`  ✅ AI selected element ${selectedElement.index}: ${selectedElement.tag} - "${selectedElement.text?.substring(0, 50)}"`);
      console.log(`      Details: ${elementDetails.join(' | ')}`);

      // Step 6: Interact with element
      const urlBefore = browserController.getCurrentUrl();
      
      // Store element info for summary (before interaction)
      const elementText = selectedElement.text?.substring(0, 60) || selectedElement.ariaLabel?.substring(0, 60) || `${selectedElement.tag} (no text)`;
      const elementHref = selectedElement.href;
      await interactionHandler.interact(page, selectedElement, aiResponse);
      
      // Step 7: Check if navigation occurred
      const urlAfter = browserController.getCurrentUrl();
      const navigated = navigationTracker.trackNavigation(urlAfter);
      
      if (navigated) {
        console.log(`  🌐 Navigation detected: ${urlBefore} → ${urlAfter}`);
        // Wait for page to settle before capturing elements
        try {
          await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
        } catch {
          // Continue even if load states timeout
        }
        // Additional wait for dynamic content
        await page.waitForTimeout(config.navigation.wait_after_navigation);
      }

      // Capture page title, key elements, and notable elements after navigation (if navigated)
      let pageTitle: string | undefined;
      let keyElements: Array<{ tag?: string; text?: string; id?: string; selector?: string }> | undefined;
      let notableElements: Array<{ selector?: string; text?: string; tag?: string; id?: string; reason?: string }> | undefined;
      
      if (navigated) {
        // Get page title
        pageTitle = await page.evaluate(() => document.title).catch(() => '');
        
        // Get key elements (headings) for display
        keyElements = await page.evaluate(() => {
          const keyElements: Array<{ tag?: string; text?: string; id?: string; selector?: string }> = [];
          const headings = document.querySelectorAll('h1, h2');
          headings.forEach((el, idx) => {
            if (idx < 5) {
              const text = el.textContent?.trim();
              if (text && text.length > 0 && text.length < 200) {
                keyElements.push({
                  tag: el.tagName.toLowerCase(),
                  text: text,
                  id: el.id || undefined,
                });
              }
            }
          });
          return keyElements;
        }).catch(() => []);
        
        // Use DOMScanner to collect notable elements (reuses shadow DOM traversal)
        if (config.element_extraction.enable_notable_elements !== false) {
          const pageElements = await domScanner.collectNotableElements(page);
          
          // Use AI to identify notable elements
          if (pageElements && pageElements.length > 0) {
            console.log(`    📋 Found ${pageElements.length} page elements, identifying notable ones...`);
            notableElements = await aiClient.identifyNotableElements(
              pageElements,
              pageTitle || 'Unknown',
              urlAfter
            );
          } else {
            console.log(`    ⚠️  No page elements found for notable element identification (pageElements: ${pageElements?.length || 0})`);
          }
        }
      }

      // Add test step to test plan
      const testStep: TestStep = {
        stepNumber: testPlan.steps.length + 1,
        action: aiResponse.action,
        element: {
          tag: selectedElement.tag,
          selector: selectedElement.selector,
          text: selectedElement.text,
          href: selectedElement.href,
          id: selectedElement.id,
          xpath: elementContext?.xpath,
          ariaLabel: selectedElement.ariaLabel,
          role: selectedElement.role,
          isInShadowDOM: selectedElement.shadowDOM || false,
        },
        urlBefore: urlBefore,
        urlAfter: urlAfter,
        navigated: navigated,
        value: aiResponse.value,
        waitAfter: navigated ? config.navigation.wait_after_navigation : config.interaction.delay_after,
        timestamp: new Date().toISOString(),
        pageTitle: pageTitle,
        keyElements: keyElements,
        notableElements: notableElements,
      };
      testPlan.steps.push(testStep);

      // Display loop time
      const loopElapsedTime = performance.now() - loopStartTime;
      console.log(`\n  ⏱️  Total loop time: ${formatTime(loopElapsedTime)}`);

      // Store loop summary
      loopSummaries.push({
        loop: loopCount,
        elementText: elementText,
        elementHref: elementHref,
        url: urlAfter,
        time: loopElapsedTime
      });

      // Check if we've reached either limit
      if (navigationTracker.hasReachedMax(config.navigation.max_navigations)) {
        console.log('\n  ⚠️  Maximum navigations reached. Stopping.');
        break;
      }
      
      if (config.navigation.max_loops > 0 && loopCount >= config.navigation.max_loops) {
        console.log('\n  ⚠️  Maximum loops reached. Stopping.');
        break;
      }

      // Step 7: Loop back to step 1 (implicitly continues)
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Exploration complete!');
    console.log(`📍 Total navigations: ${navigationTracker.getNavigationCount()}`);
    console.log(`🔄 Total loops: ${loopCount}`);
    
    // Display summary table
    if (loopSummaries.length > 0) {
      // ANSI color codes
      const reset = '\x1b[0m';
      const bold = '\x1b[1m';
      const cyan = '\x1b[36m';
      const yellow = '\x1b[33m';
      const green = '\x1b[32m';
      const blue = '\x1b[34m';
      const magenta = '\x1b[35m';
      const gray = '\x1b[90m';
      const bgBlue = '\x1b[44m';
      const bgGray = '\x1b[100m';
      
      console.log(`\n${bold}${cyan}📊 Loop Summary Table:${reset}`);
      console.log(`${gray}${'='.repeat(100)}${reset}`);
      
      // Table header - define column widths (visual width, not including ANSI codes)
      const colWidths = [10, 45, 45, 12];
      
      const header = [
        `${bold}${bgBlue} 🔄 Loop ${reset}`,
        `${bold}${bgBlue} 🖱️  Element Clicked ${reset}`,
        `${bold}${bgBlue} 🌐 URL After ${reset}`,
        `${bold}${bgBlue} ⏱️  Time ${reset}`
      ];
      
      // Print header with proper alignment
      let headerRow = '';
      header.forEach((col, idx) => {
        headerRow += padToWidth(col, colWidths[idx]);
      });
      console.log(headerRow);
      console.log(`${gray}${'-'.repeat(112)}${reset}`);
      
      // Print rows with alternating colors
      loopSummaries.forEach((summary, idx) => {
        const isEven = idx % 2 === 0;
        const rowColor = isEven ? '' : gray;
        const resetRow = isEven ? reset : reset;
        
        // Truncate text to fit column width (accounting for icon and spacing)
        // Icons take 2 characters, plus 1 space = 3 characters total
        const maxElementTextWidth = colWidths[1] - 3; // -3 for icon and space
        const maxUrlWidth = colWidths[2] - 3; // -3 for icon and space
        
        // Truncate based on actual string length (not visual width)
        const elementTextLen = summary.elementText.length;
        const elementDisplay = elementTextLen > maxElementTextWidth
          ? summary.elementText.substring(0, maxElementTextWidth - 3) + '...'
          : summary.elementText;
        const urlLen = summary.url.length;
        const urlDisplay = urlLen > maxUrlWidth
          ? summary.url.substring(0, maxUrlWidth - 3) + '...'
          : summary.url;
        const timeDisplay = formatTimePlain(summary.time);
        
        // Determine icon based on element type or status
        let elementIcon = '🔘';
        if (summary.elementText.includes('No elements')) {
          elementIcon = '⚠️';
        } else if (summary.elementText.includes('Invalid')) {
          elementIcon = '❌';
        } else if (summary.elementHref) {
          elementIcon = '🔗';
        } else {
          elementIcon = '🖱️';
        }
        
        // Color code the time based on duration
        let timeColor = green; // Fast (< 2s)
        if (summary.time > 5000) {
          timeColor = yellow; // Slow (> 5s)
        } else if (summary.time > 2000) {
          timeColor = cyan; // Medium (2-5s)
        }
        
        // Build row cells with proper padding
        const row = [
          padToWidth(`${bold}${magenta}#${summary.loop}${resetRow}`, colWidths[0]),
          padToWidth(`${rowColor}${elementIcon} ${elementDisplay}${resetRow}`, colWidths[1]),
          padToWidth(`${rowColor}${summary.url.length > maxUrlWidth ? '🔗' : '📍'} ${urlDisplay}${resetRow}`, colWidths[2]),
          padToWidth(`${timeColor}${timeDisplay}${resetRow}`, colWidths[3])
        ];
        
        console.log(row.join(''));
      });
      
      console.log(`${gray}${'='.repeat(112)}${reset}`);
      
      // Summary stats
      const totalTime = loopSummaries.reduce((sum, s) => sum + s.time, 0);
      const avgTime = totalTime / loopSummaries.length;
      const fastestLoop = loopSummaries.reduce((min, s) => s.time < min.time ? s : min, loopSummaries[0]);
      const slowestLoop = loopSummaries.reduce((max, s) => s.time > max.time ? s : max, loopSummaries[0]);
      
      console.log(`\n${bold}${cyan}📈 Summary Statistics:${reset}`);
      console.log(`   ${green}✓${reset} Total loops: ${bold}${magenta}${loopSummaries.length}${reset}`);
      console.log(`   ${green}✓${reset} Total time: ${bold}${blue}${formatTimePlain(totalTime)}${reset}`);
      console.log(`   ${green}✓${reset} Average time per loop: ${bold}${blue}${formatTimePlain(avgTime)}${reset}`);
      console.log(`   ${yellow}⚡${reset} Fastest loop: ${bold}#${fastestLoop.loop}${reset} (${formatTimePlain(fastestLoop.time)})`);
      console.log(`   ${yellow}🐌${reset} Slowest loop: ${bold}#${slowestLoop.loop}${reset} (${formatTimePlain(slowestLoop.time)})`);
    }
    
    console.log(`\n🔗 Visited URLs:`);
    navigationTracker.getVisitedUrls().forEach((url, idx) => {
      console.log(`   ${idx + 1}. ${url}`);
    });
    console.log('='.repeat(60));

    // Save test plan to markdown file
    const testPlanDir = join(process.cwd(), 'test-plan');
    mkdirSync(testPlanDir, { recursive: true });
    const testPlanPath = join(testPlanDir, 'test-plan.md');
    const markdown = testPlanToMarkdown(testPlan);
    writeFileSync(testPlanPath, markdown, 'utf-8');
    console.log(`\n📝 Test plan saved to: ${testPlanPath}`);
    console.log(`   Total steps: ${testPlan.steps.length}`);

  } catch (error: any) {
    // Save test plan even if there was an error
    try {
      const testPlanDir = join(process.cwd(), 'test-plan');
      mkdirSync(testPlanDir, { recursive: true });
      const testPlanPath = join(testPlanDir, 'test-plan.md');
      const markdown = testPlanToMarkdown(testPlan);
      writeFileSync(testPlanPath, markdown, 'utf-8');
      console.error(`\n📝 Test plan saved to: ${testPlanPath} (partial - error occurred)`);
    } catch (saveError) {
      console.error('Failed to save test plan:', saveError);
    }
    
    console.error('❌ Error during exploration:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await browserController.close();
  }
}

main().catch(console.error);


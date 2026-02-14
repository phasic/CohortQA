import { loadConfig } from './config.js';
import { BrowserController } from './browser/BrowserController.js';
import { DOMScanner } from './scanner/DOMScanner.js';
import { ElementExtractor } from './extractor/ElementExtractor.js';
import { AIClient } from './ai/AIClient.js';
import { InteractionHandler } from './interaction/InteractionHandler.js';
import { NavigationTracker } from './tracker/NavigationTracker.js';

async function main() {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('-u') + 1;
  const url = urlIndex > 0 ? args[urlIndex] : undefined;

  if (!url) {
    console.error('Usage: npm start -- -u <url>');
    process.exit(1);
  }

  // Load configuration
  console.log('📋 Loading configuration...');
  const config = loadConfig();
  console.log('✅ Configuration loaded');

  // Initialize components
  const browserController = new BrowserController(config);
  const domScanner = new DOMScanner(config);
  const elementExtractor = new ElementExtractor(config);
  const aiClient = new AIClient(config);
  const interactionHandler = new InteractionHandler(config);
  const navigationTracker = new NavigationTracker();

  try {
    // Step 1: Initialize browser
    await browserController.initialize();

    // Step 1: Navigate to initial URL
    await browserController.navigateTo(url);
    navigationTracker.trackNavigation(browserController.getCurrentUrl());

    // Main loop
    while (!navigationTracker.hasReachedMax(config.navigation.max_navigations)) {
      console.log('\n' + '='.repeat(60));
      console.log(`🔄 Loop iteration (Navigations: ${navigationTracker.getNavigationCount()}/${config.navigation.max_navigations})`);
      console.log('='.repeat(60));

      // Step 2: Scan DOM (including shadow DOM)
      const page = browserController.getPage();
      const allElements = await domScanner.scanDOM(page);

      if (allElements.length === 0) {
        console.log('⚠️  No interactable elements found. Stopping.');
        break;
      }

      // Step 3: Extract interactable elements with guardrails
      const elements = elementExtractor.extract(allElements);

      if (elements.length === 0) {
        console.log('⚠️  No elements passed guardrails. Stopping.');
        break;
      }

      // Step 4: Feed to AI model
      const visitedUrls = navigationTracker.getVisitedUrls();
      const aiResponse = await aiClient.selectElement(elements, visitedUrls);

      // Validate AI response
      if (aiResponse.elementIndex < 0 || aiResponse.elementIndex >= elements.length) {
        console.error(`❌ Invalid element index from AI: ${aiResponse.elementIndex}`);
        break;
      }

      const selectedElement = elements[aiResponse.elementIndex];
      console.log(`✅ AI selected element ${selectedElement.index}: ${selectedElement.tag} - "${selectedElement.text?.substring(0, 50)}"`);

      // Step 6: Interact with element
      const urlBefore = browserController.getCurrentUrl();
      await interactionHandler.interact(page, selectedElement, aiResponse);
      
      // Step 7: Check if navigation occurred
      const urlAfter = browserController.getCurrentUrl();
      const navigated = navigationTracker.trackNavigation(urlAfter);
      
      if (navigated) {
        console.log(`🌐 Navigation detected: ${urlBefore} → ${urlAfter}`);
        // Wait a bit for page to settle
        await page.waitForTimeout(config.navigation.wait_after_navigation);
      }

      // Step 7: Loop back to step 1 (implicitly continues)
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Exploration complete!');
    console.log(`📍 Total navigations: ${navigationTracker.getNavigationCount()}`);
    console.log(`🔗 Visited URLs:`);
    navigationTracker.getVisitedUrls().forEach((url, idx) => {
      console.log(`   ${idx + 1}. ${url}`);
    });
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ Error during exploration:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await browserController.close();
  }
}

main().catch(console.error);


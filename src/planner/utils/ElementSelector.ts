import { Page } from '@playwright/test';
import { DecisionMaker, type InteractiveElement, type PageContext } from '../../ai/DecisionMaker.js';
import { PLANNER_CONFIG } from '../config.js';
import { InteractionTracker } from './InteractionTracker.js';
import { UrlNormalizer } from './UrlNormalizer.js';

/**
 * Result of element selection
 */
export interface ElementSelectionResult {
  element: InteractiveElement;
  method: string;
  reasoning?: string;
}

/**
 * Utility for selecting the best element to interact with
 */
export class ElementSelector {
  /**
   * Selects the best element to interact with using AI or heuristics
   */
  static async selectElement(
    page: Page,
    interactiveElements: InteractiveElement[],
    useAI: boolean,
    decisionMaker: DecisionMaker,
    visitedUrls: Set<string>,
    currentMaxNavigations: number,
    interactionTracker: InteractionTracker,
    initialUrl: string
  ): Promise<ElementSelectionResult> {
    if (interactiveElements.length === 0) {
      throw new Error('No interactive elements available');
    }

    // If AI is enabled, try to use it
    if (useAI) {
      console.log(`🔍 ElementSelector: useAI=true, attempting AI selection...`);
      console.log(`🔍 ElementSelector: decisionMaker.isEnabled()=${decisionMaker.isEnabled()}`);
      try {
        const result = await this.selectWithAI(
          page,
          interactiveElements,
          decisionMaker,
          visitedUrls,
          currentMaxNavigations,
          interactionTracker,
          initialUrl
        );
        if (result) {
          console.log(`🔍 ElementSelector: AI selection successful, method=${result.method}`);
          return result;
        } else {
          console.log(`🔍 ElementSelector: AI selection returned null, falling back to heuristics`);
        }
      } catch (error) {
        console.log(`🔍 ElementSelector: AI selection error: ${error}, falling back to heuristics`);
        // Fall back to heuristics on AI error
      }
    } else {
      console.log(`🔍 ElementSelector: useAI=false, using heuristics directly`);
    }

    // Use heuristics as fallback
    const selectedIndex = DecisionMaker.selectBestElementHeuristic(interactiveElements, Array.from(visitedUrls));
    return {
      element: interactiveElements[selectedIndex],
      method: 'heuristic',
    };
  }

  /**
   * Selects element using AI decision maker
   */
  private static async selectWithAI(
    page: Page,
    interactiveElements: InteractiveElement[],
    decisionMaker: DecisionMaker,
    visitedUrls: Set<string>,
    currentMaxNavigations: number,
    interactionTracker: InteractionTracker,
    initialUrl: string
  ): Promise<ElementSelectionResult | null> {
    // Get page context for AI
    const pageContextData = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        headings: Array.from(document.querySelectorAll('h1, h2, h3'))
          .slice(0, 5)
          .map((h: Element) => h.textContent?.trim() || ''),
      };
    });

    // Limit elements shown to AI for faster processing
    // Randomly select a subset to give variety across runs
    const maxElementsToShow = PLANNER_CONFIG.MAX_ELEMENTS_TO_SHOW_AI;
    const shuffled = [...interactiveElements].sort(() => Math.random() - 0.5);
    const elementsForAI = shuffled.slice(0, maxElementsToShow);

    // Build context for AI
    const fullContext: PageContext = {
      url: pageContextData.url,
      title: pageContextData.title,
      headings: pageContextData.headings,
      elements: elementsForAI.map((el, idx) => ({
        ...el,
        index: idx,
      })),
      visitedUrls: Array.from(visitedUrls),
      targetNavigations: currentMaxNavigations,
      currentNavigations: visitedUrls.size,
      recentInteractionKeys: interactionTracker.getRecentKeys(5),
    };

    const recommendation = await decisionMaker.recommendBestInteraction(fullContext);

    if (!recommendation) {
      return null;
    }

    // Map AI index back to full array (AI only sees subset)
    const proposed = elementsForAI[recommendation.elementIndex];
    const proposedKey = interactionTracker.makeInteractionKey(proposed);
    const proposedText = (proposed.text || '').toLowerCase();
    const proposedHref = (proposed.href || '').split('#')[0].replace(/\/$/, '');
    const normalizedInitial = initialUrl ? initialUrl.split('#')[0].replace(/\/$/, '') : '';
    const isHomey =
      proposedText === 'home' ||
      proposedText.includes('home') ||
      (proposed.isLink && proposedHref === normalizedInitial);

    const blocked = new Set(interactionTracker.getRecentKeys(10));
    const isBlocked = blocked.has(proposedKey) || isHomey;

    if (isBlocked) {
      // Find alternative that's not blocked
      const candidateIndices = interactiveElements
        .map((el, idx) => ({ el, idx, key: interactionTracker.makeInteractionKey(el) }))
        .filter(({ el, key }) => {
          if (blocked.has(key)) return false;
          const text = (el.text || '').toLowerCase();
          if (text === 'home' || text.includes('home')) return false;
          if (el.isLink && el.href) {
            const href = el.href.split('#')[0].replace(/\/$/, '');
            if (visitedUrls.has(href)) return false;
          }
          return true;
        })
        .map(({ idx }) => idx);

      if (candidateIndices.length > 0) {
        return {
          element: interactiveElements[candidateIndices[0]],
          method: 'AI (de-duped)',
          reasoning: recommendation.reasoning,
        };
      } else {
        // Fall back to heuristics
        const selectedIndex = DecisionMaker.selectBestElementHeuristic(interactiveElements, Array.from(visitedUrls));
        return {
          element: interactiveElements[selectedIndex],
          method: 'heuristic (AI repeated)',
        };
      }
    } else {
      // Find the proposed element in the full interactiveElements array
      const proposedIndex = interactiveElements.findIndex((el) => {
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
        return {
          element: interactiveElements[proposedIndex],
          method: 'AI',
          reasoning: recommendation.reasoning,
        };
      } else {
        // Fallback if we can't find the element in the full array
        const selectedIndex = DecisionMaker.selectBestElementHeuristic(interactiveElements, Array.from(visitedUrls));
        return {
          element: interactiveElements[selectedIndex],
          method: 'heuristic (element not found)',
        };
      }
    }
  }
}


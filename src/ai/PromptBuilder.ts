import { PageContext, InteractiveElement } from './types.js';

export class PromptBuilder {
  /**
   * Builds the main prompt for element selection
   */
  static buildElementSelectionPrompt(context: PageContext, maxElements: number = 12): string {
    const elementsToShow = context.elements.slice(0, maxElements);
    const elementsSummary = this.formatElementsSummary(elementsToShow, maxElements);
    const recent = (context.recentInteractionKeys || []).slice(-5); // Reduced from 10 to 5
    
    return `Select the best element to click for test coverage.

Page: ${context.title} (${context.url})
Goal: ${context.currentNavigations}/${context.targetNavigations} pages explored
${recent.length > 0 ? `Avoid: ${recent.join(', ')}\n` : ''}
Elements:
${elementsSummary}

Priority: 1) Links to NEW pages 2) Investment/product links 3) Main content links
Avoid: Sidebar/nav menus, repeated clicks, already visited URLs

Respond ONLY with JSON:
{"elementIndex": <0-${elementsToShow.length - 1}>, "reasoning": "<brief>"}`;
  }

  /**
   * Formats a list of interactive elements into a readable summary
   */
  private static formatElementsSummary(elements: InteractiveElement[], maxElements: number): string {
    return elements
      .slice(0, maxElements)
      .map((el, idx) => {
        const hrefInfo = el.isLink && el.href ? `(${el.href})` : '';
        return `${idx}: ${el.type} - "${el.text || el.selector}" ${hrefInfo}`;
      })
      .join('\n');
  }
}


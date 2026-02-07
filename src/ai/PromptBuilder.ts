import { PageContext, InteractiveElement } from './types.js';
import { injectPersonality, Personality } from '../utils/personality.js';

export class PromptBuilder {
  /**
   * Builds the main prompt for element selection
   */
  static buildElementSelectionPrompt(
    context: PageContext, 
    maxElements: number = 12,
    personality?: Personality
  ): string {
    // Build default prompt
    console.log('📝 Using DEFAULT prompt for element selection');
    const elementsToShow = context.elements.slice(0, maxElements);
    const elementsSummary = this.formatElementsSummary(elementsToShow, maxElements);
    const recent = (context.recentInteractionKeys || []).slice(-5); // Reduced from 10 to 5
    
    const basePrompt = `Select the best element to click for test coverage.

Page: ${context.title} (${context.url})
Goal: ${context.currentNavigations}/${context.targetNavigations} pages explored
${recent.length > 0 ? `Avoid: ${recent.join(', ')}\n` : ''}
Elements:
${elementsSummary}

Priority: 1) Links to NEW pages 2) Investment/product links 3) Main content links
Avoid: Sidebar/nav menus, repeated clicks, already visited URLs

Respond ONLY with JSON:
{"elementIndex": <0-${elementsToShow.length - 1}>, "reasoning": "<brief>"}`;
    
    // Inject personality if provided
    if (personality) {
      console.log(`🎭 Injecting personality: ${personality}`);
      return injectPersonality(basePrompt, personality);
    }
    
    return basePrompt;
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

  /**
   * Replaces placeholders in custom prompts with actual values
   */
  private static replacePromptPlaceholders(
    template: string,
    context: PageContext,
    maxElements: number
  ): string {
    const elementsToShow = context.elements.slice(0, maxElements);
    const elementsSummary = this.formatElementsSummary(elementsToShow, maxElements);
    const recent = (context.recentInteractionKeys || []).slice(-5);
    
    return template
      .replace(/\{title\}/g, context.title)
      .replace(/\{url\}/g, context.url)
      .replace(/\{currentNavigations\}/g, String(context.currentNavigations))
      .replace(/\{targetNavigations\}/g, String(context.targetNavigations))
      .replace(/\{recentInteractions\}/g, recent.length > 0 ? recent.join(', ') : '')
      .replace(/\{elements\}/g, elementsSummary)
      .replace(/\{maxIndex\}/g, String(elementsToShow.length - 1));
  }
}


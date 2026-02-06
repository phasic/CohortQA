import { InteractiveElement } from './types.js';

/**
 * Heuristic-based element selection when AI is not available
 */
export class HeuristicSelector {
  /**
   * Selects the best element using heuristics
   */
  static selectBestElement(elements: InteractiveElement[], visitedUrls: string[]): number {
    if (elements.length === 0) {
      throw new Error('No elements available for selection');
    }

    // Prioritize links for navigation
    const unvisitedLink = this.findUnvisitedLink(elements, visitedUrls);
    if (unvisitedLink !== null) {
      return unvisitedLink;
    }

    // Then prioritize buttons with action words
    const actionButton = this.findActionButton(elements);
    if (actionButton !== null) {
      return actionButton;
    }

    // Fallback to random
    return Math.floor(Math.random() * elements.length);
  }

  /**
   * Finds an unvisited navigation link
   */
  private static findUnvisitedLink(
    elements: InteractiveElement[],
    visitedUrls: string[]
  ): number | null {
    const links = elements
      .map((el, idx) => ({ el, idx }))
      .filter(({ el }) => {
        if (!el.isLink || !el.href) return false;
        const normalizedUrl = el.href.split('#')[0].replace(/\/$/, '');
        return !visitedUrls.includes(normalizedUrl);
      });

    if (links.length === 0) {
      return null;
    }

    // Prefer links with meaningful text
    const meaningfulLinks = links.filter(
      ({ el }) => el.text && el.text.trim().length > 0 && el.text.trim().length < 50
    );

    return meaningfulLinks.length > 0 ? meaningfulLinks[0].idx : links[0].idx;
  }

  /**
   * Finds a button with action-oriented text
   */
  private static findActionButton(elements: InteractiveElement[]): number | null {
    const actionWords = [
      'submit', 'search', 'login', 'next', 'continue',
      'go', 'view', 'see', 'explore', 'browse', 'shop',
      'add', 'create', 'start', 'begin', 'apply'
    ];

    const actionButtons = elements
      .map((el, idx) => ({ el, idx }))
      .filter(({ el }) => {
        if (el.isLink || el.type !== 'button') return false;
        const text = el.text.toLowerCase();
        return actionWords.some(word => text.includes(word));
      });

    return actionButtons.length > 0 ? actionButtons[0].idx : null;
  }
}


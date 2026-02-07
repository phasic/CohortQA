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
        
        // Skip JavaScript links and hash-only links (unless they're to different pages)
        const href = el.href.trim();
        if (href === '#' || href.startsWith('javascript:') || href === '') {
          return false;
        }
        
        // Normalize URL for comparison
        try {
          const urlObj = new URL(href, 'http://dummy.com'); // Use dummy base for relative URLs
          const normalizedUrl = urlObj.pathname.replace(/\/$/, '');
          
          // Skip if it's just a hash change on the same page
          if (normalizedUrl === '' || normalizedUrl === '/') {
            return false;
          }
          
          // Check if we've visited this path
          return !visitedUrls.some(visited => {
            try {
              const visitedObj = new URL(visited, 'http://dummy.com');
              return visitedObj.pathname.replace(/\/$/, '') === normalizedUrl;
            } catch {
              return visited.includes(normalizedUrl);
            }
          });
        } catch {
          // If URL parsing fails, use simple string comparison
          const normalizedUrl = href.split('#')[0].replace(/\/$/, '');
          return normalizedUrl !== '' && !visitedUrls.includes(normalizedUrl);
        }
      });

    if (links.length === 0) {
      return null;
    }

    // Prefer links with meaningful text and actual navigation (not just hash)
    const meaningfulLinks = links.filter(
      ({ el }) => {
        if (!el.text || el.text.trim().length === 0 || el.text.trim().length > 50) {
          return false;
        }
        // Prefer links that look like they navigate (not just anchors)
        const href = el.href || '';
        return !href.startsWith('#') || href.length > 1; // Allow hash if it's meaningful
      }
    );

    if (meaningfulLinks.length > 0) {
      // Prefer links that are likely to navigate to new pages
      const navigationLinks = meaningfulLinks.filter(({ el }) => {
        const href = el.href || '';
        return !href.startsWith('#') && href.length > 1;
      });
      
      if (navigationLinks.length > 0) {
        return navigationLinks[0].idx;
      }
      
      return meaningfulLinks[0].idx;
    }

    return links[0].idx;
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


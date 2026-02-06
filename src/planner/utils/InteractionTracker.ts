import { InteractiveElement } from '../../ai/types.js';

/**
 * Tracks recent interactions to avoid repeating the same actions
 */
export class InteractionTracker {
  private recentInteractionKeys: string[] = [];

  /**
   * Creates a stable key for an element to track interactions
   */
  makeInteractionKey(el: InteractiveElement): string {
    // Prefer stable keys: type + href + selector + text (trimmed)
    const href = (el.href || '').split('#')[0].replace(/\/$/, '');
    const text = (el.text || '').trim().slice(0, 60);
    const selector = (el.selector || '').trim().slice(0, 80);
    return `${el.type}|${href}|${selector}|${text}`.replace(/\s+/g, ' ');
  }

  /**
   * Records an interaction with an element
   */
  rememberInteraction(el: InteractiveElement, maxHistory: number = 50): void {
    const key = this.makeInteractionKey(el);
    this.recentInteractionKeys.push(key);
    // Keep history bounded
    if (this.recentInteractionKeys.length > maxHistory) {
      this.recentInteractionKeys = this.recentInteractionKeys.slice(-maxHistory);
    }
  }

  /**
   * Gets recent interaction keys (for AI context)
   */
  getRecentKeys(count: number = 20): string[] {
    return this.recentInteractionKeys.slice(-count);
  }

  /**
   * Checks if an element was recently interacted with
   */
  wasRecentlyInteractedWith(el: InteractiveElement): boolean {
    const key = this.makeInteractionKey(el);
    return this.recentInteractionKeys.includes(key);
  }

  /**
   * Clears interaction history
   */
  clear(): void {
    this.recentInteractionKeys = [];
  }
}


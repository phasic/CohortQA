import { InteractableElement, Config } from '../types.js';

export class ElementExtractor {
  private config: Config;
  private startingDomain: string | null = null;
  private stayOnPath: string | null = null;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Sets the starting domain to enforce stay_on_domain guardrail
   */
  setStartingDomain(url: string): void {
    try {
      const urlObj = new URL(url);
      this.startingDomain = urlObj.hostname;
    } catch {
      // Invalid URL, ignore
    }
  }

  /**
   * Sets the path restriction from config
   */
  setStayOnPath(): void {
    if (this.config.stay_on_path) {
      try {
        const urlObj = new URL(this.config.stay_on_path);
        // Extract the pathname (e.g., "/product/7230/open")
        this.stayOnPath = urlObj.pathname;
      } catch {
        // Invalid URL, ignore
      }
    }
  }

  /**
   * Extracts the domain from a URL string
   */
  private getDomainFromUrl(url: string, currentUrl: string): string | null {
    try {
      // Handle relative URLs
      const urlObj = new URL(url, currentUrl);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a URL is within the allowed path restriction
   */
  private isWithinAllowedPath(url: string, currentUrl: string): boolean {
    if (!this.stayOnPath) {
      return true; // No path restriction set
    }

    try {
      const urlObj = new URL(url, currentUrl);
      const targetPath = urlObj.pathname;
      
      // Check if target path starts with the required path
      // This allows subpaths and query params
      return targetPath.startsWith(this.stayOnPath);
    } catch {
      return false; // Invalid URL
    }
  }

  /**
   * Checks if an element would navigate away from the starting domain or allowed path
   */
  private wouldNavigateAway(element: InteractableElement, currentUrl: string): boolean {
    // Only check elements with href (links)
    if (!element.href) {
      return false; // Not a link, can't navigate away
    }

    // Check path restriction first (if set)
    if (this.stayOnPath) {
      return !this.isWithinAllowedPath(element.href, currentUrl);
    }

    // Check domain restriction (if enabled and no path restriction)
    if (this.config.navigation.stay_on_domain && this.startingDomain) {
      const targetDomain = this.getDomainFromUrl(element.href, currentUrl);
      if (!targetDomain) {
        return false; // Invalid URL, allow it (will fail gracefully)
      }
      return targetDomain !== this.startingDomain;
    }

    return false; // No restrictions enabled
  }

  /**
   * Normalizes a URL for comparison (same logic as NavigationTracker)
   */
  private normalizeUrl(url: string, baseUrl: string): string {
    try {
      const urlObj = new URL(url, baseUrl);
      // Remove hash
      urlObj.hash = '';
      // Remove trailing slash from pathname
      let pathname = urlObj.pathname;
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      urlObj.pathname = pathname;
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Checks if an element would navigate to an already visited URL
   */
  private wouldNavigateToVisitedUrl(element: InteractableElement, currentUrl: string, visitedUrls: string[]): boolean {
    // Only check elements with href (links)
    if (!element.href) {
      return false; // Not a link, can't navigate
    }

    try {
      const targetUrl = this.normalizeUrl(element.href, currentUrl);
      return visitedUrls.some(visitedUrl => {
        const normalizedVisited = this.normalizeUrl(visitedUrl, currentUrl);
        return normalizedVisited === targetUrl;
      });
    } catch {
      return false; // Invalid URL, allow it (will fail gracefully)
    }
  }

  /**
   * Formats elapsed time for display
   */
  private formatTime(ms: number): string {
    const blue = '\x1b[34m';
    const reset = '\x1b[0m';
    const time = ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
    return `${blue}${time}${reset}`;
  }

  /**
   * Checks if a selector or ID contains a random hash pattern
   */
  private hasRandomHashId(str: string): boolean {
    if (!str) return false;
    const randomHashPatterns = [
      /^invoker-[a-z0-9]{6,}$/i,  // invoker- followed by 6+ random chars (e.g., invoker-a7jm11z7zz)
      /^[a-z]+-[a-z0-9]{8,}$/i,   // word-dash followed by 8+ random chars
      /-[a-z0-9]{10,}/i,           // dash followed by 10+ random chars anywhere
      /^[a-z0-9]{12,}$/i,          // pure alphanumeric 12+ chars (likely random)
    ];
    return randomHashPatterns.some(pattern => pattern.test(str));
  }

  /**
   * Filters and extracts interactable elements based on guardrails
   * Since DOMScanner already uses the whitelist, this mainly filters by visibility and limits count
   */
  extract(elements: InteractableElement[], currentUrl: string, visitedUrls: string[] = []): InteractableElement[] {
    console.log(`  🔧 Extracting elements with guardrails (${elements.length} total)...`);
    const startTime = performance.now();
    
    let filtered = elements.filter(element => {
      // Check visibility (whitelist filtering is already done in DOMScanner)
      if (!this.config.element_extraction.include_invisible && !element.isVisible) {
        return false;
      }

      // Filter out elements with random hash IDs in selector or id field
      if (element.selector) {
        // Extract ID from selector if it's in #id format
        const idMatch = element.selector.match(/^#([a-z0-9-]+)/i);
        if (idMatch && this.hasRandomHashId(idMatch[1])) {
          return false; // Skip elements with random hash ID selectors
        }
        // Also check the full selector string
        if (this.hasRandomHashId(element.selector)) {
          return false;
        }
      }
      
      // Filter out elements with random hash IDs
      if (element.id && this.hasRandomHashId(element.id)) {
        return false; // Skip elements with random hash IDs
      }

      // Check if element would navigate away from domain
      if (this.wouldNavigateAway(element, currentUrl)) {
        return false;
      }

      // Check if element would navigate to an already visited URL
      if (this.wouldNavigateToVisitedUrl(element, currentUrl, visitedUrls)) {
        return false;
      }

      return true;
    });

    // Limit number of elements
    if (this.config.element_extraction.max_elements > 0) {
      filtered = filtered.slice(0, this.config.element_extraction.max_elements);
    }

    const blockedCount = elements.length - filtered.length;
    const domainBlocked = elements.filter(e => this.wouldNavigateAway(e, currentUrl)).length;
    const visitedBlocked = elements.filter(e => this.wouldNavigateToVisitedUrl(e, currentUrl, visitedUrls)).length;
    
    if (domainBlocked > 0 && this.config.navigation.stay_on_domain) {
      console.log(`    🚫 Blocked ${domainBlocked} elements that would navigate away from domain`);
    }
    if (visitedBlocked > 0) {
      console.log(`    🔄 Blocked ${visitedBlocked} elements that would navigate to already visited URLs`);
    }

    const elapsedTime = performance.now() - startTime;
    console.log(`    ✅ Extracted ${filtered.length} elements after filtering (${this.formatTime(elapsedTime)})`);
    return filtered;
  }
}


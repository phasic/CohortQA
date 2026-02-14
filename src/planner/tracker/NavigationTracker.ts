export class NavigationTracker {
  private visitedUrls: Set<string> = new Set();
  private navigationCount: number = 0;

  /**
   * Normalizes URL for comparison (removes hash, trailing slashes, etc.)
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
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
   * Checks if URL has changed and tracks navigation
   */
  trackNavigation(currentUrl: string): boolean {
    const normalized = this.normalizeUrl(currentUrl);
    
    if (!this.visitedUrls.has(normalized)) {
      this.visitedUrls.add(normalized);
      this.navigationCount++;
      console.log(`    📍 New navigation detected (${this.navigationCount}): ${currentUrl}`);
      return true;
    }
    
    return false;
  }

  /**
   * Gets the current navigation count
   */
  getNavigationCount(): number {
    return this.navigationCount;
  }

  /**
   * Gets all visited URLs
   */
  getVisitedUrls(): string[] {
    return Array.from(this.visitedUrls);
  }

  /**
   * Checks if we've reached the max navigations
   */
  hasReachedMax(maxNavigations: number): boolean {
    return this.navigationCount >= maxNavigations;
  }

  /**
   * Checks if a URL has already been visited
   */
  hasVisited(url: string): boolean {
    const normalized = this.normalizeUrl(url);
    return this.visitedUrls.has(normalized);
  }

  /**
   * Normalizes a URL (public method for use by other components)
   */
  normalizeUrlForComparison(url: string): string {
    return this.normalizeUrl(url);
  }
}


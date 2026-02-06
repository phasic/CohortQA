/**
 * Utility for normalizing URLs for comparison
 */
export class UrlNormalizer {
  /**
   * Normalizes a URL for comparison by removing:
   * - Fragments (#)
   * - Trailing slashes
   * - Converting to lowercase
   * 
   * NOTE: Query parameters are KEPT to count as URL changes
   * (e.g., ?category=investments vs ?category=savings are different pages)
   */
  static normalize(url: string): string {
    try {
      const urlObj = new URL(url);
      // Keep query parameters, remove fragments, normalize path
      let normalized = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
      // Add query parameters if they exist
      if (urlObj.search) {
        // Sort query parameters for consistent comparison
        const params = new URLSearchParams(urlObj.search);
        const sortedParams = Array.from(params.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => `${key}=${value}`)
          .join('&');
        normalized += `?${sortedParams}`;
      }
      // Remove trailing slash (but keep it if it's just the root)
      if (normalized.endsWith('/') && normalized.split('/').length > 4) {
        normalized = normalized.replace(/\/$/, '');
      }
      // Convert to lowercase for consistency
      return normalized.toLowerCase();
    } catch {
      // Fallback for invalid URLs - keep query params
      const withoutFragment = url.split('#')[0];
      const withoutTrailing = withoutFragment.replace(/\/$/, '');
      return withoutTrailing.toLowerCase();
    }
  }
}


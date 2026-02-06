/**
 * Manages caching of AI-generated prefixes
 */
export class PrefixCache {
  private cache: Map<string, string> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  /**
   * Gets a cached prefix
   */
  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  /**
   * Sets a cached prefix
   */
  set(key: string, value: string): void {
    this.cache.set(key, value);
    
    // Limit cache size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Checks if a key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clears the cache
   */
  clear(): void {
    this.cache.clear();
  }
}


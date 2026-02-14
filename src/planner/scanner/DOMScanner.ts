import { Page } from '@playwright/test';
import { InteractableElement, Config } from '../types.js';

export class DOMScanner {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
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
   * Scans the DOM including shadow DOM for all interactable elements
   */
  async scanDOM(page: Page): Promise<InteractableElement[]> {
    console.log('  🔍 Scanning DOM (including shadow DOM)...');
    const startTime = performance.now();
    
    // Wait for page to be stable before scanning
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    } catch {
      // Continue even if load states timeout
    }
    
    // Pass the whitelist selectors and blacklist tags to the browser context
    const selectors = this.config.element_extraction.interactable_elements;
    const blacklistTags = this.config.element_extraction.blacklist_tags || [];
    
    let elements: InteractableElement[] = [];
    let retries = 3;
    
    while (retries > 0) {
      try {
        const result = await page.evaluate(({ whitelistSelectors, blacklistTags }: { whitelistSelectors: string[], blacklistTags: string[] }) => {
      // Step 1: Check if an element is blacklisted (itself or any ancestor)
      function isBlacklisted(element: Element): boolean {
        if (blacklistTags.length === 0) {
          return false;
        }
        
        let current: Element | null = element;
        const visited = new Set<Element>();
        
        while (current) {
          // Prevent infinite loops
          if (visited.has(current)) {
            break;
          }
          visited.add(current);
          
          // Check if current element is blacklisted
          const tagName = current.tagName.toLowerCase();
          if (blacklistTags.includes(tagName)) {
            return true;
          }
          
          // Get parent, handling shadow DOM boundaries
          const root = current.getRootNode();
          if (root instanceof ShadowRoot) {
            // If in shadow DOM, check the host element
            current = root.host;
            if (current) {
              const hostTagName = current.tagName.toLowerCase();
              if (blacklistTags.includes(hostTagName)) {
                return true;
              }
            }
          } else {
            current = current.parentElement;
          }
        }
        
        return false;
      }

      // Step 2: Get all direct children of an element (including shadow DOM children)
      function getAllChildren(element: Element): Element[] {
        const children: Element[] = [];
        
        // Get regular DOM children (direct children only)
        Array.from(element.children).forEach(child => {
          children.push(child);
        });
        
        // Get shadow DOM children if element has a shadow root
        if (element.shadowRoot) {
          // Get all direct children in shadow root
          // ShadowRoot doesn't have children property, so traverse manually
          const shadowRoot = element.shadowRoot;
          let child: Element | null = shadowRoot.firstElementChild;
          while (child) {
            children.push(child);
            child = child.nextElementSibling;
          }
        }
        
        return children;
      }

      // Step 3: Iteratively collect all non-blacklisted elements
      const allNonBlacklistedElements: Element[] = [];
      const processed = new Set<Element>();
      
      // Start with document body (or document if no body)
      const startElement = document.body || document.documentElement;
      if (startElement && !isBlacklisted(startElement as Element)) {
        allNonBlacklistedElements.push(startElement as Element);
      }
      
      // Iteratively process elements and their children
      let index = 0;
      while (index < allNonBlacklistedElements.length) {
        const currentElement = allNonBlacklistedElements[index];
        
        // Skip if already processed
        if (processed.has(currentElement)) {
          index++;
          continue;
        }
        processed.add(currentElement);
        
        // Get all children of current element
        const children = getAllChildren(currentElement);
        
        // Check each child and add if not blacklisted
        children.forEach(child => {
          if (!isBlacklisted(child) && !allNonBlacklistedElements.includes(child)) {
            allNonBlacklistedElements.push(child);
          }
        });
        
        index++;
      }

      // Step 4: Filter by interactable_elements
      // Create a set for fast lookup
      const elementSet = new Set(allNonBlacklistedElements);
      const filteredElements: HTMLElement[] = [];
      
      // Check each non-blacklisted element against the interactable_elements
      allNonBlacklistedElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        
        // Check if this element matches any of the interactable_elements
        let matches = false;
        for (const selector of whitelistSelectors) {
          try {
            // Check if element matches the selector
            if (element.matches && element.matches(selector)) {
              matches = true;
              break;
            }
          } catch (e) {
            // Ignore selector errors
          }
        }
        
        if (matches) {
          filteredElements.push(htmlElement);
        }
      });

      // Step 5: Convert to InteractableElement format
      const interactableElements: any[] = [];
      let elementIndex = 0;

      // Helper function to check for random hash IDs
      function hasRandomHashId(str: string): boolean {
        if (!str) return false;
        const randomHashPatterns = [
          /^invoker-[a-z0-9]{6,}$/i,  // invoker- followed by 6+ random chars (e.g., invoker-a7jm11z7zz)
          /^[a-z]+-[a-z0-9]{8,}$/i,   // word-dash followed by 8+ random chars
          /-[a-z0-9]{10,}/i,           // dash followed by 10+ random chars anywhere
          /^[a-z0-9]{12,}$/i,          // pure alphanumeric 12+ chars (likely random)
        ];
        return randomHashPatterns.some(pattern => pattern.test(str));
      }

      function generateSelector(element: HTMLElement): string {
        // Prefer ID if available, but skip random hash IDs
        if (element.id && !hasRandomHashId(element.id)) {
          return `#${element.id}`;
        }
        
        let selector = element.tagName.toLowerCase();
        if (element.className) {
          const classes = element.className.split(' ').filter((c: string) => c).join('.');
          if (classes) {
            selector += `.${classes}`;
          }
        }
        
        // Add nth-child if needed for uniqueness
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (el) => (el as Element).tagName === element.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(element) + 1;
            selector += `:nth-child(${index})`;
          }
        }
        
        return selector;
      }

      // Function to check if element is in a shadow DOM
      function isInShadowDOM(element: Element): boolean {
        const root = element.getRootNode();
        return root instanceof ShadowRoot;
      }

      // Function to create a unique identifier for finding elements in shadow DOM
      function createElementIdentifier(element: HTMLElement): any {
        return {
          tag: element.tagName.toLowerCase(),
          text: element.textContent?.trim() || '',
          href: (element as HTMLAnchorElement).href || undefined,
          id: element.id || undefined,
          className: element.className || undefined,
          ariaLabel: element.getAttribute('aria-label') || undefined,
          role: element.getAttribute('role') || undefined,
          boundingBox: {
            x: element.getBoundingClientRect().x,
            y: element.getBoundingClientRect().y,
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height,
          }
        };
      }

      filteredElements.forEach(element => {
        // Check if element is actually visible and interactable
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0'
        ) {
          const tag = element.tagName.toLowerCase();
          const text = element.textContent?.trim() || '';
          const href = (element as HTMLAnchorElement).href || undefined;
          const id = element.id || undefined;
          const className = element.className || undefined;
          const ariaLabel = element.getAttribute('aria-label') || undefined;
          const role = element.getAttribute('role') || undefined;
          
          let type: string | undefined;
          if (element instanceof HTMLInputElement) {
            type = element.type;
          }

          // Helper function to check for random hash IDs (reuse from above)
          function hasRandomHashId(str: string): boolean {
            const randomHashPatterns = [
              /invoker-[a-z0-9]{6,}/i,  // invoker- followed by 6+ random chars
              /^[a-z]+-[a-z0-9]{8,}$/i, // word-dash followed by 8+ random chars
              /-[a-z0-9]{10,}/i,        // dash followed by 10+ random chars anywhere
              /^[a-z0-9]{12,}$/i,       // pure alphanumeric 12+ chars (likely random)
            ];
            return randomHashPatterns.some(pattern => pattern.test(str));
          }

          const elementData: any = {
            index: elementIndex++,
            tag,
            type,
            text: text.substring(0, 200), // Limit text length
            selector: generateSelector(element),
            href,
            id: (id && !hasRandomHashId(id)) ? id : undefined, // Don't include random hash IDs
            className,
            ariaLabel,
            role,
            isVisible: true,
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
          };

          // Store identifier for shadow DOM elements
          if (isInShadowDOM(element)) {
            elementData.shadowDOM = true;
            elementData.elementIdentifier = createElementIdentifier(element as HTMLElement);
          }

          interactableElements.push(elementData);
        }
      });
      
      return interactableElements;
    }, { whitelistSelectors: selectors, blacklistTags });
        
        elements = result as InteractableElement[];
        // Success - break out of retry loop
        break;
      } catch (error: any) {
        retries--;
        
        // Check if error is due to navigation
        if (error.message && error.message.includes('Execution context was destroyed')) {
          if (retries > 0) {
            console.log(`      ⚠️  Page navigated during scan, waiting and retrying (${retries} retries left)...`);
            // Wait for page to stabilize
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
            await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(500); // Small delay before retry
            continue;
          } else {
            throw new Error('Page navigated during DOM scan and all retries exhausted');
          }
        } else {
          // Different error, throw immediately
          throw error;
        }
      }
    }

    const elapsedTime = performance.now() - startTime;
    console.log(`    ✅ Found ${elements.length} interactable elements (${this.formatTime(elapsedTime)})`);
    return elements;
  }

  /**
   * Collects notable elements from the page (including shadow DOM) for AI analysis
   */
  async collectNotableElements(page: Page): Promise<Array<{
    tag: string;
    text?: string;
    selector?: string;
    id?: string;
    href?: string;
    role?: string;
  }>> {
    // Check if notable elements are enabled
    if (this.config.element_extraction.enable_notable_elements === false) {
      return [];
    }
    
    const notableSelectors = this.config.element_extraction.notable_elements || [];
    
    if (notableSelectors.length === 0) {
      return [];
    }

    const result = await page.evaluate(({ notableSelectors, blacklistTags }: { notableSelectors: string[], blacklistTags: string[] }) => {
      // Reuse the same blacklist checking logic
      function isBlacklisted(element: Element): boolean {
        if (blacklistTags.length === 0) {
          return false;
        }
        
        let current: Element | null = element;
        const visited = new Set<Element>();
        
        while (current) {
          if (visited.has(current)) {
            break;
          }
          visited.add(current);
          
          const tagName = current.tagName.toLowerCase();
          if (blacklistTags.includes(tagName)) {
            return true;
          }
          
          const root = current.getRootNode();
          if (root instanceof ShadowRoot) {
            current = root.host;
            if (current) {
              const hostTagName = current.tagName.toLowerCase();
              if (blacklistTags.includes(hostTagName)) {
                return true;
              }
            }
          } else {
            current = current.parentElement;
          }
        }
        
        return false;
      }

      // Get all direct children including shadow DOM
      function getAllChildren(element: Element): Element[] {
        const children: Element[] = [];
        Array.from(element.children).forEach(child => {
          children.push(child);
        });
        
        if (element.shadowRoot) {
          const shadowRoot = element.shadowRoot;
          let child: Element | null = shadowRoot.firstElementChild;
          while (child) {
            children.push(child);
            child = child.nextElementSibling;
          }
        }
        
        return children;
      }

      // Collect all elements matching notable selectors
      const notableElements: Element[] = [];
      const processed = new Set<Element>();
      const startElement = document.body || document.documentElement;
      
      if (!startElement || isBlacklisted(startElement as Element)) {
        return [];
      }

      const toProcess: Element[] = [startElement as Element];
      let index = 0;
      const maxDepth = 10;
      let currentDepth = 0;
      const depthMap = new Map<Element, number>();
      depthMap.set(startElement as Element, 0);

      while (index < toProcess.length && notableElements.length < 100) {
        const current = toProcess[index];
        index++;
        
        if (processed.has(current)) {
          continue;
        }
        processed.add(current);
        
        currentDepth = depthMap.get(current) || 0;
        
        if (currentDepth >= maxDepth) {
          continue;
        }

        // Check if element matches any notable selector
        if (!isBlacklisted(current)) {
          notableSelectors.forEach(selector => {
            try {
              if (current.matches && current.matches(selector)) {
                notableElements.push(current);
              }
            } catch (e) {
              // Ignore selector errors
            }
          });
        }

        // Get children including shadow DOM
        const children = getAllChildren(current);
        children.forEach(child => {
          if (!processed.has(child) && !isBlacklisted(child)) {
            toProcess.push(child);
            depthMap.set(child, currentDepth + 1);
          }
        });
      }

      // Helper function to check for random hash IDs
      function hasRandomHashId(str: string): boolean {
        if (!str) return false;
        const randomHashPatterns = [
          /^invoker-[a-z0-9]{6,}$/i,  // invoker- followed by 6+ random chars (e.g., invoker-a7jm11z7zz)
          /^[a-z]+-[a-z0-9]{8,}$/i,   // word-dash followed by 8+ random chars
          /-[a-z0-9]{10,}/i,           // dash followed by 10+ random chars anywhere
          /^[a-z0-9]{12,}$/i,          // pure alphanumeric 12+ chars (likely random)
        ];
        return randomHashPatterns.some(pattern => pattern.test(str));
      }

      // Convert to return format
      return notableElements.map(el => {
        const tag = el.tagName.toLowerCase();
        const text = el.textContent?.trim();
        const id = el.id || undefined;
        const href = (el as HTMLAnchorElement).href || undefined;
        const role = el.getAttribute('role') || undefined;
        
        let simpleSelector: string | undefined;
        if (id) {
          // Only use ID as selector if it's not a random hash
          if (!hasRandomHashId(id)) {
            simpleSelector = `#${id}`;
          }
        }
        
        // If we don't have a selector yet (or skipped random hash ID), try class-based selector
        if (!simpleSelector && el.className && typeof el.className === 'string') {
          const classes = el.className.split(' ').filter(c => c).slice(0, 2).join('.');
          if (classes) {
            simpleSelector = `${tag}.${classes}`;
          }
        }

        const placeholder = (el as HTMLInputElement).placeholder || undefined;
        const value = (el as HTMLInputElement).value || undefined;
        const ariaLabel = el.getAttribute('aria-label') || undefined;
        const displayText = text || placeholder || value || ariaLabel || undefined;

        return {
          tag,
          text: displayText && displayText.length < 150 ? displayText : displayText?.substring(0, 147) + '...',
          selector: simpleSelector,
          id: hasRandomHashId(id || '') ? undefined : id, // Don't include random hash IDs
          href,
          role,
        };
      }).filter(el => {
        // Filter: include if has text, is input, has placeholder, value, or aria-label
        const hasText = el.text && el.text.length > 0;
        const isInput = el.tag === 'input' || el.tag === 'textarea' || el.tag === 'select';
        
        // Also filter out elements that only have random hash IDs (no stable selector)
        const hasStableSelector = el.selector || (el.id && !hasRandomHashId(el.id));
        
        return (hasText || isInput) && hasStableSelector;
      });
    }, { 
      notableSelectors, 
      blacklistTags: this.config.element_extraction.blacklist_tags || [] 
    });

    return result || [];
  }
}


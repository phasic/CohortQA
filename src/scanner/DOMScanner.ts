import { Page } from '@playwright/test';
import { InteractableElement, Config } from '../types.js';

export class DOMScanner {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Scans the DOM including shadow DOM for all interactable elements
   */
  async scanDOM(page: Page): Promise<InteractableElement[]> {
    console.log('🔍 Scanning DOM (including shadow DOM)...');
    
    // Pass the whitelist selectors to the browser context
    const selectors = this.config.element_extraction.include_selectors;
    
    const elements = await page.evaluate((whitelistSelectors: string[]) => {
      const interactableElements: any[] = [];
      let index = 0;

      // Function to recursively find elements in shadow DOM
      function findElementsInShadow(root: Document | ShadowRoot | Element): void {
        // TypeScript: this code runs in browser context where DOM types exist
        // Use the whitelist selectors from config
        const selectors = whitelistSelectors;

        selectors.forEach(selector => {
          try {
            const nodes = root.querySelectorAll(selector);
            nodes.forEach((node: Element) => {
              const element = node as HTMLElement;
              
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

                interactableElements.push({
                  index: index++,
                  tag,
                  type,
                  text: text.substring(0, 200), // Limit text length
                  selector: generateSelector(element),
                  href,
                  id,
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
                });
              }
            });
          } catch (e) {
            // Ignore selector errors
          }
        });

        // Recursively check shadow DOM
        const allElements = root.querySelectorAll('*');
        allElements.forEach(element => {
          if (element.shadowRoot) {
            findElementsInShadow(element.shadowRoot);
          }
        });
      }

      // Generate a unique selector for an element
      function generateSelector(element: HTMLElement): string {
        // TypeScript: this code runs in browser context where DOM types exist
        if (element.id) {
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

      // Start scanning from document
      findElementsInShadow(document);
      
      return interactableElements;
    }, selectors);

    console.log(`✅ Found ${elements.length} interactable elements`);
    return elements as InteractableElement[];
  }
}


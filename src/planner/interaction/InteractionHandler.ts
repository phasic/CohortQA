import { Page } from '@playwright/test';
import { InteractableElement, AIResponse, Config } from '../types.js';

export class InteractionHandler {
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
   * Interacts with an element based on AI response
   */
  async interact(
    page: Page,
    element: InteractableElement,
    aiResponse: AIResponse
  ): Promise<void> {
    console.log(`  🖱️  Interacting with element ${element.index}: ${aiResponse.action}`);
    console.log(`      Reasoning: ${aiResponse.reasoning}`);
    const startTime = performance.now();
    
    // Wait before interaction
    await page.waitForTimeout(this.config.interaction.delay_before);
    
    try {
      switch (aiResponse.action) {
        case 'click':
          await this.clickElement(page, element);
          break;
        case 'type':
          await this.typeElement(page, element, aiResponse.value || '');
          break;
        case 'select':
          await this.selectElement(page, element, aiResponse.value || '');
          break;
        case 'hover':
          await this.hoverElement(page, element);
          break;
        case 'scroll':
          await this.scrollToElement(page, element);
          break;
        default:
          throw new Error(`Unknown action: ${aiResponse.action}`);
      }
      
      // Wait after interaction (minimal delay for UI to process)
      await page.waitForTimeout(this.config.interaction.delay_after);
      
      // Note: wait_timeout is now handled in the main loop after checking for navigation
      // This reduces unnecessary waiting when no navigation occurs
      
      const elapsedTime = performance.now() - startTime;
      console.log(`    ✅ Interaction complete (${this.formatTime(elapsedTime)})`);
    } catch (error: any) {
      const elapsedTime = performance.now() - startTime;
      console.error(`    ❌ Interaction failed after ${this.formatTime(elapsedTime)}: ${error.message}`);
      throw error;
    }
  }

  // Function to find and click element in shadow DOM using identifier
  private async clickElementInShadowDOM(page: Page, identifier: any): Promise<boolean> {
    return await page.evaluate((id: any) => {
      // Function to recursively search for element in shadow DOMs
      function findInShadow(root: Document | ShadowRoot | Element): HTMLElement | null {
        // Search in current root
        const allElements = root.querySelectorAll('*');
        for (const el of Array.from(allElements)) {
          const htmlEl = el as HTMLElement;
          
          // Match by identifier properties
          let matches = true;
          
          if (id.tag && htmlEl.tagName.toLowerCase() !== id.tag) {
            matches = false;
          }
          
          if (matches && id.id && htmlEl.id !== id.id) {
            matches = false;
          }
          
          if (matches && id.href && (htmlEl as HTMLAnchorElement).href !== id.href) {
            matches = false;
          }
          
          if (matches && id.text) {
            const elText = htmlEl.textContent?.trim() || '';
            if (!elText.includes(id.text.substring(0, 20))) {
              matches = false;
            }
          }
          
          if (matches && id.boundingBox) {
            const rect = htmlEl.getBoundingClientRect();
            const tolerance = 10; // Allow small differences
            if (Math.abs(rect.x - id.boundingBox.x) > tolerance ||
                Math.abs(rect.y - id.boundingBox.y) > tolerance) {
              matches = false;
            }
          }
          
          if (matches) {
            return htmlEl;
          }
          
          // Recursively check shadow DOMs
          if (htmlEl.shadowRoot) {
            const found = findInShadow(htmlEl.shadowRoot);
            if (found) return found;
          }
        }
        
        return null;
      }
      
      const foundElement = findInShadow(document);
      if (foundElement) {
        // Scroll into view
        foundElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Click the element
        if (typeof foundElement.click === 'function') {
          foundElement.click();
          return true;
        }
        
        // Fallback: dispatch click event
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        foundElement.dispatchEvent(event);
        return true;
      }
      
      return false;
    }, identifier);
  }

  private async clickElement(page: Page, element: InteractableElement): Promise<void> {
    try {
      // If element is in shadow DOM, use special handling
      if (element.shadowDOM && element.elementIdentifier) {
        const clicked = await this.clickElementInShadowDOM(page, element.elementIdentifier);
        if (clicked) {
          console.log(`      ✓ Clicked shadow DOM element using identifier`);
          await page.waitForTimeout(100); // Wait for scroll
          return;
        } else {
          console.log(`      ⚠️  Could not find shadow DOM element by identifier, trying coordinate click...`);
          
          // Fallback: Click by coordinates if we have bounding box
          if (element.boundingBox) {
            const centerX = element.boundingBox.x + element.boundingBox.width / 2;
            const centerY = element.boundingBox.y + element.boundingBox.height / 2;
            await page.mouse.click(centerX, centerY);
            console.log(`      ✓ Clicked shadow DOM element using coordinates: (${Math.round(centerX)}, ${Math.round(centerY)})`);
            await page.waitForTimeout(100);
            return;
          }
        }
      }

      // First, wait for the element to be visible and attached
      try {
        await page.waitForSelector(element.selector, { 
          state: 'visible', 
          timeout: 5000 
        });
      } catch {
        // If selector doesn't work immediately, we'll try alternative methods
        console.log(`      ⚠️  Selector "${element.selector}" not immediately available, trying alternatives...`);
      }

      // Scroll element into view
      const scrolled = await page.evaluate((selector: string) => {
        const el = document.querySelector(selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
        return false;
      }, element.selector);

      if (scrolled) {
        // Wait a bit for scroll to complete (reduced from 300ms)
        await page.waitForTimeout(100);
      }

      // Try multiple click strategies
      let clickSucceeded = false;
      let lastError: Error | null = null;

      // Strategy 1: Standard click
      try {
        await page.click(element.selector, { 
          timeout: 5000,
          force: false,
          noWaitAfter: false
        });
        clickSucceeded = true;
        console.log(`      ✓ Clicked using selector: ${element.selector}`);
      } catch (error1: any) {
        lastError = error1;
        // Strategy 2: Force click if element might be covered
        try {
          await page.click(element.selector, { 
            timeout: 5000,
            force: true,
            noWaitAfter: false
          });
          clickSucceeded = true;
          console.log(`      ✓ Clicked using force: ${element.selector}`);
        } catch (error2: any) {
          lastError = error2;
          // Strategy 3: Click via JavaScript (most reliable for shadow DOM)
          try {
            const clicked = await page.evaluate((selector: string) => {
              // Try to find element, including in shadow DOMs
              function findElement(selector: string, root: Document | ShadowRoot | Element): HTMLElement | null {
                try {
                  const el = root.querySelector(selector) as HTMLElement;
                  if (el) return el;
                } catch {}
                
                // Search in shadow DOMs
                const allElements = root.querySelectorAll('*');
                for (const el of Array.from(allElements)) {
                  if (el.shadowRoot) {
                    const found = findElement(selector, el.shadowRoot);
                    if (found) return found;
                  }
                }
                return null;
              }
              
              const el = findElement(selector, document);
              if (el) {
                if (typeof el.click === 'function') {
                  el.click();
                  return true;
                }
                const event = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                el.dispatchEvent(event);
                return true;
              }
              return false;
            }, element.selector);

            if (clicked) {
              clickSucceeded = true;
              console.log(`      ✓ Clicked using JavaScript (shadow DOM aware): ${element.selector}`);
            } else {
              throw new Error('Element not found for JavaScript click');
            }
          } catch (error3: any) {
            lastError = error3;
            // Strategy 4: Try finding element by text content if we have text
            if (element.text) {
              try {
                const text = element.text.trim().substring(0, 50);
                await page.click(`text="${text}"`, { timeout: 3000, force: true });
                clickSucceeded = true;
                console.log(`      ✓ Clicked using text: "${text}"`);
              } catch (error4: any) {
                lastError = error4;
                // Strategy 5: Try finding by href if it's a link
                if (element.href) {
                  try {
                    await page.click(`a[href="${element.href}"]`, { timeout: 3000, force: true });
                    clickSucceeded = true;
                    console.log(`      ✓ Clicked using href: ${element.href}`);
                  } catch (error5: any) {
                    lastError = error5;
                  }
                }
              }
            }
          }
        }
      }

      if (!clickSucceeded) {
        // Final fallback: Try to find and click by ID
        if (element.id) {
          try {
            await page.click(`#${element.id}`, { timeout: 3000, force: true });
            clickSucceeded = true;
            console.log(`      ✓ Clicked using ID: #${element.id}`);
          } catch {
            // Continue to throw error
          }
        }
      }

      if (!clickSucceeded && lastError) {
        throw lastError;
      }
    } catch (error: any) {
      throw new Error(`Failed to click element "${element.text?.substring(0, 30) || element.selector}": ${error.message}`);
    }
  }

  private async typeElement(page: Page, element: InteractableElement, value: string): Promise<void> {
    try {
      await page.fill(element.selector, value);
    } catch (error) {
      // Fallback: try typing by index if selector fails
      const elements = await page.$$(element.selector);
      if (elements.length > 0) {
        await elements[0].fill(value);
      } else {
        throw error;
      }
    }
  }

  private async selectElement(page: Page, element: InteractableElement, value: string): Promise<void> {
    try {
      await page.selectOption(element.selector, value);
    } catch (error) {
      // Fallback: try selecting by index if selector fails
      const elements = await page.$$(element.selector);
      if (elements.length > 0) {
        await elements[0].selectOption(value);
      } else {
        throw error;
      }
    }
  }

  private async hoverElement(page: Page, element: InteractableElement): Promise<void> {
    try {
      await page.hover(element.selector);
    } catch (error) {
      // Fallback: try hovering by index if selector fails
      const elements = await page.$$(element.selector);
      if (elements.length > 0) {
        await elements[0].hover();
      } else {
        throw error;
      }
    }
  }

  private async scrollToElement(page: Page, element: InteractableElement): Promise<void> {
    await page.evaluate((selector: string) => {
      // TypeScript: this code runs in browser context where DOM types exist
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, element.selector);
  }
}


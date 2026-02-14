import { Page } from '@playwright/test';
import { InteractableElement, AIResponse, Config } from '../types.js';

export class InteractionHandler {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Interacts with an element based on AI response
   */
  async interact(
    page: Page,
    element: InteractableElement,
    aiResponse: AIResponse
  ): Promise<void> {
    console.log(`🖱️  Interacting with element ${element.index}: ${aiResponse.action}`);
    console.log(`   Reasoning: ${aiResponse.reasoning}`);
    
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
      
      // Wait after interaction
      await page.waitForTimeout(this.config.interaction.delay_after);
      
      // Wait for potential navigation or content changes
      await page.waitForTimeout(this.config.interaction.wait_timeout);
      
      console.log(`✅ Interaction complete`);
    } catch (error: any) {
      console.error(`❌ Interaction failed: ${error.message}`);
      throw error;
    }
  }

  private async clickElement(page: Page, element: InteractableElement): Promise<void> {
    try {
      await page.click(element.selector, { timeout: 5000 });
    } catch (error) {
      // Fallback: try clicking by index if selector fails
      const elements = await page.$$(element.selector);
      if (elements.length > 0) {
        await elements[0].click();
      } else {
        throw error;
      }
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


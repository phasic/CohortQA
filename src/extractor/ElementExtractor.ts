import { InteractableElement, Config } from '../types.js';

export class ElementExtractor {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Filters and extracts interactable elements based on guardrails
   * Since DOMScanner already uses the whitelist, this mainly filters by visibility and limits count
   */
  extract(elements: InteractableElement[]): InteractableElement[] {
    console.log(`🔧 Extracting elements with guardrails (${elements.length} total)...`);
    
    let filtered = elements.filter(element => {
      // Check visibility (whitelist filtering is already done in DOMScanner)
      if (!this.config.element_extraction.include_invisible && !element.isVisible) {
        return false;
      }

      return true;
    });

    // Limit number of elements
    if (this.config.element_extraction.max_elements > 0) {
      filtered = filtered.slice(0, this.config.element_extraction.max_elements);
    }

    console.log(`✅ Extracted ${filtered.length} elements after filtering`);
    return filtered;
  }
}


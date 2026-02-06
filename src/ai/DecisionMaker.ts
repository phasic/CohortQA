import { PageContext, AIRecommendation, AIProvider } from './types.js';
import { ProviderFactory } from './ProviderFactory.js';
import { AIClient } from './AIClient.js';
import { HeuristicSelector } from './HeuristicSelector.js';

/**
 * Main decision maker that uses AI or heuristics to select the best interaction
 */
export class DecisionMaker {
  private client: AIClient | null = null;
  private provider: AIProvider;
  private enabled: boolean = false;

  constructor() {
    this.provider = ProviderFactory.detectProvider();
    this.client = ProviderFactory.createClient(this.provider);
    this.enabled = this.client !== null;

    if (this.enabled && this.provider === 'ollama') {
      console.log('🤖 Using Ollama (local, free) for AI decisions');
      // Note: We don't check if server is running here to avoid blocking
      // The actual call will fail gracefully if server is down
    }
  }

  /**
   * Checks if AI is enabled and available
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Gets the current AI provider
   */
  getProvider(): AIProvider {
    return this.provider;
  }

  /**
   * Gets the model name being used
   */
  getModel(): string | null {
    if (!this.enabled || !this.client) {
      return null;
    }
    // Access the config from the client
    return (this.client as any).config?.model || null;
  }

  /**
   * Recommends the best interaction using AI, or returns null to fall back to heuristics
   */
  async recommendBestInteraction(context: PageContext): Promise<AIRecommendation | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    try {
      const recommendation = await this.client.call(context);
      return recommendation;
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      
      // Provide more helpful error messages
      if (errorMsg.includes('not running')) {
        console.warn(`  ⚠️  ${errorMsg}`);
        console.warn(`  💡 Tip: Run 'ollama serve' in another terminal, then try again`);
      } else if (errorMsg.includes('model') || errorMsg.includes('404')) {
        console.warn(`  ⚠️  ${errorMsg}`);
        console.warn(`  💡 Tip: Make sure the model is installed: ollama pull mistral`);
      } else {
        console.warn(`  ⚠️  AI decision failed: ${errorMsg}`);
      }
      
      console.warn(`  🔄 Falling back to heuristic selection...`);
      return null;
    }
  }

  /**
   * Selects the best element using heuristics (fallback when AI is not available)
   */
  static selectBestElementHeuristic(
    elements: PageContext['elements'],
    visitedUrls: string[]
  ): number {
    return HeuristicSelector.selectBestElement(elements, visitedUrls);
  }
}

// Re-export types for convenience
export type { PageContext, InteractiveElement, AIRecommendation } from './types.js';

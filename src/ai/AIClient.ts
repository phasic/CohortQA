import { PageContext, AIRecommendation, AIProvider } from './types.js';
import { PromptBuilder } from './PromptBuilder.js';

export interface AIClientConfig {
  apiUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export abstract class AIClient {
  protected config: AIClientConfig;
  protected personality?: string;

  constructor(config: AIClientConfig, personality?: string) {
    this.config = config;
    this.personality = personality as any;
  }

  /**
   * Makes an API call to the AI provider and returns a recommendation
   */
  abstract call(context: PageContext): Promise<AIRecommendation>;

  /**
   * Parses the AI response and extracts the JSON recommendation
   */
  protected parseRecommendation(
    responseContent: string,
    context: PageContext
  ): AIRecommendation {
    if (!responseContent || responseContent.trim().length === 0) {
      throw new Error('AI returned empty response');
    }

    // Extract JSON from response (handle markdown code blocks, extra text, etc.)
    // Try to find JSON object in the response
    let jsonStr = responseContent.trim();
    
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    let recommendation: AIRecommendation;
    try {
      recommendation = JSON.parse(jsonStr) as AIRecommendation;
    } catch (parseError: any) {
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}. Response: ${jsonStr.substring(0, 200)}`);
    }
    
    // Validate recommendation structure
    if (typeof recommendation.elementIndex !== 'number') {
      throw new Error(`AI response missing elementIndex. Got: ${JSON.stringify(recommendation)}`);
    }
    
    if (recommendation.elementIndex < 0 || recommendation.elementIndex >= context.elements.length) {
      throw new Error(`AI returned invalid element index: ${recommendation.elementIndex} (valid range: 0-${context.elements.length - 1})`);
    }

    return recommendation;
  }

  /**
   * Builds the prompt for element selection
   */
  protected buildPrompt(context: PageContext): string {
    return PromptBuilder.buildElementSelectionPrompt(context, 12, this.personality as any);
  }
}


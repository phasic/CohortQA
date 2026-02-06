import { Personality } from '../types.js';

/**
 * Builds prompts for AI prefix generation
 */
export class PromptBuilder {
  /**
   * Builds a prompt for generating a prefix based on personality
   */
  static buildPrefixPrompt(personality: Personality, context: string): string {
    const personalityDescriptions: Record<Personality, string> = {
      thinking: 'a short, playful phrase (5-8 words)',
      realizing: 'a short, playful exclamation or reaction (1-2 words, like "Oh!", "Hmm,", "Interesting,")',
      deciding: 'a short, spontaneous thinking phrase (2-4 words, like "Let me try", "Maybe", "I think")',
      acting: 'a short action verb (1 word, like "Clicking", "Going", "Trying", "Selecting")'
    };

    return `Generate ${personalityDescriptions[personality]} for a playful AI assistant exploring a website. Context: "${context.substring(0, 50)}". 

Respond with ONLY the prefix text, nothing else. No quotes, no explanation, just the prefix.`;
  }

  /**
   * Builds a prompt for generating a thinking message
   */
  static buildThinkingMessagePrompt(elementCount: number): string {
    return `Generate a short, playful phrase (5-8 words) for an AI assistant thinking about which of ${elementCount} elements to click on a webpage. Be spontaneous and curious. Respond with ONLY the phrase, no quotes, no explanation.`;
  }
}


import { Personality } from '../types.js';
import { PERSONALITIES, Personality as PersonalityType } from '../../../utils/personality.js';

/**
 * Builds prompts for AI prefix generation
 */
export class PromptBuilder {
  /**
   * Builds a prompt for generating a prefix based on personality
   */
  static buildPrefixPrompt(
    personality: Personality, 
    context: string,
    personalityType?: PersonalityType,
    personalityDescriptions?: {
      thinking?: string;
      realizing?: string;
      deciding?: string;
      acting?: string;
    }
  ): string {
    // Get personality template if available
    const personalityTemplate = personalityType ? PERSONALITIES[personalityType] : null;
    
    // Use personality template prefix if available, otherwise use default
    const prefixTemplate = personalityTemplate?.ttsPrefix || 'Generate a playful phrase for a fun AI assistant exploring a website.';
    
    // Use provided personality descriptions or fall back to template or defaults
    const descriptions: Record<Personality, string> = {
      thinking: personalityDescriptions?.thinking || personalityTemplate?.ttsPersonalityDescriptions?.thinking || 'a short, playful phrase (5-8 words)',
      realizing: personalityDescriptions?.realizing || personalityTemplate?.ttsPersonalityDescriptions?.realizing || 'a short, playful exclamation or reaction (1-2 words, like "Oh!", "Hmm,", "Interesting,")',
      deciding: personalityDescriptions?.deciding || personalityTemplate?.ttsPersonalityDescriptions?.deciding || 'a short, spontaneous thinking phrase (2-4 words, like "Let me try", "Maybe", "I think")',
      acting: personalityDescriptions?.acting || personalityTemplate?.ttsPersonalityDescriptions?.acting || 'a short action verb (1 word, like "Clicking", "Going", "Trying", "Selecting")'
    };

    return `${prefixTemplate} Generate ${descriptions[personality]} for an AI assistant exploring a website. Context: "${context.substring(0, 50)}". 

Respond with ONLY the prefix text, nothing else. No quotes, no explanation, just the prefix.`;
  }

  /**
   * Builds a prompt for generating a thinking message
   */
  static buildThinkingMessagePrompt(elementCount: number): string {
    // Default prompt (thinking messages don't use personality-specific prompts)
    return `Generate a short, playful phrase (5-8 words) for an AI assistant thinking about which of ${elementCount} elements to click on a webpage. Be spontaneous and curious. Respond with ONLY the phrase, no quotes, no explanation.`;
  }
}


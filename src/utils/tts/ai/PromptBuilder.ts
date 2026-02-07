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

    // Build a more explicit prompt that emphasizes the personality
    // Derive personality name and description from the type and template
    const personalityName = personalityType ? personalityType.charAt(0).toUpperCase() + personalityType.slice(1) : 'Playful';
    
    // Extract personality description from ttsPrefix (e.g., "annoyed, frustrated" from "Generate an annoyed, frustrated phrase...")
    let personalityDescription = 'fun and lighthearted';
    if (personalityTemplate?.ttsPrefix) {
      // Try to extract the full description including adjectives (everything before "phrase", "exclamation", etc.)
      const match = personalityTemplate.ttsPrefix.match(/Generate (an?|a) (.+?)\s+(?:phrase|exclamation|reaction|acknowledgment)/i);
      if (match && match[2]) {
        personalityDescription = match[2].trim();
      } else {
        // Fallback: try simpler pattern
        const simpleMatch = personalityTemplate.ttsPrefix.match(/Generate (an?|a) ([^,]+(?:,\s*[^,]+)?)/);
        if (simpleMatch && simpleMatch[2]) {
          personalityDescription = simpleMatch[2].trim();
        }
      }
    }
    
    // Build a very explicit prompt that strongly emphasizes the personality
    let examples = '';
    if (personalityType === 'annoyed') {
      examples = '\nExamples: "Ugh,", "Seriously?", "Again?", "Fine, whatever", "Just do it", "Whatever"';
    } else if (personalityType === 'sarcastic') {
      examples = '\nExamples: "Oh great,", "Wonderful,", "Of course,", "Why not", "Sure, whatever", "Let\'s see"';
    } else if (personalityType === 'playful') {
      examples = '\nExamples: "Oh!", "Hmm,", "Interesting,", "Let me try", "Maybe", "I think"';
    }
    
    const prompt = `You are an AI assistant with a ${personalityName} personality. You are ${personalityDescription}.

${prefixTemplate}

Your task: Generate ${descriptions[personality]} that matches this ${personalityName} personality.

CRITICAL REQUIREMENTS:
- The phrase MUST sound ${personalityDescription}
- The phrase MUST reflect the ${personalityName} personality
- Be ${personalityDescription} in tone and style
- Context: "${context.substring(0, 50)}"
${examples}

Respond with ONLY the prefix text, nothing else. No quotes, no explanation, just the prefix.`;

    console.log(`🎭 TTS Prompt for ${personalityName} (${personality}):`, prompt.substring(0, 200) + '...');
    return prompt;
  }

  /**
   * Builds a prompt for generating a thinking message
   */
  static buildThinkingMessagePrompt(elementCount: number, personalityType?: PersonalityType): string {
    // Get personality template if available
    const personalityTemplate = personalityType ? PERSONALITIES[personalityType] : null;
    const thinkingDescription = personalityTemplate?.ttsPersonalityDescriptions?.thinking || 'a short, playful phrase (5-8 words)';
    
    // Derive personality name and description
    const personalityName = personalityType ? personalityType.charAt(0).toUpperCase() + personalityType.slice(1) : 'Playful';
    
    // Extract personality description from ttsPrefix
    let personalityDescription = 'fun and lighthearted';
    if (personalityTemplate?.ttsPrefix) {
      // Try to extract the full description including adjectives (everything before "phrase", "exclamation", etc.)
      const match = personalityTemplate.ttsPrefix.match(/Generate (an?|a) (.+?)\s+(?:phrase|exclamation|reaction|acknowledgment)/i);
      if (match && match[2]) {
        personalityDescription = match[2].trim();
      } else {
        // Fallback: try simpler pattern
        const simpleMatch = personalityTemplate.ttsPrefix.match(/Generate (an?|a) ([^,]+(?:,\s*[^,]+)?)/);
        if (simpleMatch && simpleMatch[2]) {
          personalityDescription = simpleMatch[2].trim();
        }
      }
    }
    
    return `You are an AI assistant with a ${personalityName} personality (${personalityDescription}). 

Generate ${thinkingDescription} for thinking about which of ${elementCount} elements to click on a webpage. The phrase MUST sound ${personalityDescription} and match the ${personalityName} personality.

IMPORTANT: Be ${personalityDescription} in your response. Reflect the ${personalityName} personality.

Respond with ONLY the phrase, no quotes, no explanation.`;
  }
}


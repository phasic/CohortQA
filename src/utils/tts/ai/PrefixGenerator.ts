import { DecisionMaker } from '../../../ai/DecisionMaker.js';
import { Personality } from '../types.js';
import { PromptBuilder } from './PromptBuilder.js';
import { TTS_CONFIG } from '../config.js';
import { PrefixCache } from '../cache/PrefixCache.js';
import { PERSONALITIES, Personality as PersonalityType } from '../../../utils/personality.js';

/**
 * Generates AI-powered prefixes and messages for TTS
 */
export class PrefixGenerator {
  private decisionMaker: DecisionMaker | null = null;
  private cache: PrefixCache;
  private personality?: PersonalityType;
  private lastPersonality?: PersonalityType;

  constructor(personality?: PersonalityType) {
    this.cache = new PrefixCache(TTS_CONFIG.PREFIX_CACHE_SIZE);
    
    // Clear cache if personality changed
    if (this.lastPersonality && this.lastPersonality !== personality) {
      console.log(`🎭 Personality changed from ${this.lastPersonality} to ${personality}, clearing TTS cache`);
      this.cache.clear();
    }
    
    this.personality = personality;
    this.lastPersonality = personality;
    
    console.log(`🎭 PrefixGenerator initialized with personality: ${personality || 'playful'}`);
  }

  /**
   * Initializes the DecisionMaker if needed
   */
  private ensureDecisionMaker(): void {
    // Always recreate DecisionMaker with current personality to ensure it's up to date
    // (DecisionMaker is lightweight, so recreating is fine)
    this.decisionMaker = new DecisionMaker(this.personality);
  }

  /**
   * Generates a prefix using AI
   */
  async generatePrefix(personality: Personality, context: string): Promise<string> {
    console.log(`🎭 generatePrefix called: personality=${personality}, userPersonality=${this.personality || 'playful'}, context="${context.substring(0, 30)}..."`);
    
    this.ensureDecisionMaker();

    // Check if AI is available
    if (!this.decisionMaker?.isEnabled()) {
      console.log(`⚠️  AI not enabled, using fallback prefix`);
      return this.getFallbackPrefix(personality);
    }

    // Create cache key that includes both TTS personality type and user-selected personality
    const personalityKey = this.personality || 'playful';
    const cacheKey = `${personalityKey}:${personality}:${context.substring(0, 20)}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`🎭 Using cached prefix: "${cached}"`);
      return cached;
    }

    try {
      // Build prompt and call AI
      const prompt = PromptBuilder.buildPrefixPrompt(
        personality, 
        context,
        this.personality,
        this.personality ? PERSONALITIES[this.personality]?.ttsPersonalityDescriptions : undefined
      );
      console.log(`🎭 Calling AI for prefix (personality: ${this.personality || 'playful'})...`);
      const prefix = await this.callAIForPrefix(prompt);
      
      // Cache the result
      if (prefix) {
        console.log(`✅ AI generated prefix: "${prefix}"`);
        this.cache.set(cacheKey, prefix);
        return prefix;
      }
      
      console.log(`⚠️  AI returned null, using fallback prefix`);
      return this.getFallbackPrefix(personality);
    } catch (error: any) {
      console.warn(`❌ AI prefix generation failed: ${error.message}, using fallback`);
      // Fallback to hardcoded if AI fails
      return this.getFallbackPrefix(personality);
    }
  }

  /**
   * Generates a thinking message using AI
   */
  async generateThinkingMessage(elementCount: number): Promise<string> {
    this.ensureDecisionMaker();

    if (!this.decisionMaker?.isEnabled()) {
      // Fallback to hardcoded messages
      const fallbacks = TTS_CONFIG.FALLBACK_THINKING_MESSAGES;
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    try {
      const prompt = PromptBuilder.buildThinkingMessagePrompt(elementCount, this.personality);
      const message = await this.callAIForPrefix(prompt);
      return message || 'Let me think which one to click';
    } catch (error) {
      // Fallback
      return 'Let me think which one to click';
    }
  }

  /**
   * Calls AI to generate a prefix or message
   */
  private async callAIForPrefix(prompt: string): Promise<string | null> {
    if (!this.decisionMaker) return null;

    try {
      const provider = this.decisionMaker.getProvider();
      console.log(`🎭 Calling AI for TTS prefix (provider: ${provider}, personality: ${this.personality || 'playful'})`);
      
      if (provider === 'ollama') {
        const response = await fetch(process.env.OLLAMA_URL || 'http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: process.env.OLLAMA_MODEL || 'mistral',
            prompt: prompt,
            stream: false,
            options: { temperature: 1.0, num_predict: 15 } // Increased temperature and tokens for more personality
          })
        });

        if (response.ok) {
          const data = await response.json();
          let prefix = (data.response || '').trim();
          // Remove quotes
          prefix = prefix.replace(/^["']|["']$/g, '');
          // Remove explanations in parentheses like "(playful exclamation)"
          prefix = prefix.replace(/\s*\([^)]*\)\s*/g, '');
          // Take only the first line
          prefix = prefix.split('\n')[0].trim();
          console.log(`🎭 AI generated prefix: "${prefix}"`);
          return prefix || null;
        } else {
          console.warn(`⚠️  Ollama TTS prefix generation failed: ${response.status}`);
        }
      } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
        // Split prompt into system and user messages for better personality injection
        // The prompt already contains the personality instructions, but we can make it more explicit
        const systemMessage = prompt.split('\n\n')[0] || `You are an AI assistant with a ${this.personality || 'playful'} personality.`;
        const userMessage = prompt;
        
        console.log(`🎭 OpenAI TTS request - System: "${systemMessage.substring(0, 100)}..."`);
        console.log(`🎭 OpenAI TTS request - User: "${userMessage.substring(0, 200)}..."`);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: userMessage }
            ],
            temperature: 1.0, // Increased for more personality variation
            max_tokens: 15 // Increased to allow for longer phrases
          })
        });

        if (response.ok) {
          const data = await response.json();
          let prefix = data.choices[0]?.message?.content?.trim() || '';
          // Remove quotes
          prefix = prefix.replace(/^["']|["']$/g, '');
          // Remove explanations in parentheses like "(playful exclamation)" or "(annoyed reaction)"
          prefix = prefix.replace(/\s*\([^)]*\)\s*/g, '');
          // Remove any trailing periods or commas
          prefix = prefix.replace(/[.,;:]$/, '');
          prefix = prefix.trim();
          console.log(`🎭 AI generated prefix: "${prefix}"`);
          return prefix || null;
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.warn(`⚠️  OpenAI TTS prefix generation failed: ${response.status}`, errorData);
        }
      }
    } catch (error: any) {
      console.warn(`⚠️  TTS prefix generation error: ${error.message}`);
    }

    return null;
  }

  /**
   * Gets fallback prefix if AI is not available
   * Now personality-aware based on user-selected personality
   */
  private getFallbackPrefix(personality: Personality): string {
    // Get personality-specific fallbacks if available
    const personalityTemplate = this.personality ? PERSONALITIES[this.personality] : null;
    
    // Try to get personality-specific fallbacks from the template
    if (personalityTemplate?.ttsPersonalityDescriptions) {
      // Use examples from the personality template as fallbacks
      const examples = this.getPersonalityFallbackExamples(personality, personalityTemplate);
      if (examples && examples.length > 0) {
        const selected = examples[Math.floor(Math.random() * examples.length)];
        console.log(`🎭 Using personality-aware fallback (${this.personality}): "${selected}"`);
        return selected;
      }
    }
    
    // Fall back to default playful prefixes
    const fallbacks = TTS_CONFIG.FALLBACK_PREFIXES[personality as keyof typeof TTS_CONFIG.FALLBACK_PREFIXES];
    if (!fallbacks) return '';
    const selected = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    console.log(`🎭 Using default fallback (playful): "${selected}"`);
    return selected;
  }

  /**
   * Gets personality-specific fallback examples based on the personality type
   */
  private getPersonalityFallbackExamples(
    personality: Personality,
    template: typeof PERSONALITIES[keyof typeof PERSONALITIES]
  ): string[] | null {
    // Extract examples from the prompt builder examples or use personality-specific defaults
    const personalityType = this.personality;
    
    if (personalityType === 'annoyed') {
      if (personality === 'realizing') return ['Ugh,', 'Seriously?', 'Again?', 'Oh great,', 'For real?'];
      if (personality === 'deciding') return ['Fine,', 'Whatever,', 'Just do it,', 'Fine, whatever,', 'Ugh, fine'];
      if (personality === 'acting') return ['Clicking', 'Forcing', 'Trying', 'Ugh, clicking'];
    } else if (personalityType === 'sarcastic') {
      if (personality === 'realizing') return ['Oh great,', 'Wonderful,', 'Of course,', 'Perfect,', 'Lovely,'];
      if (personality === 'deciding') return ['Why not,', 'Sure, whatever,', 'Let\'s see,', 'Oh, let\'s try'];
      if (personality === 'acting') return ['Clicking', 'Going for', 'Trying', 'Selecting'];
    } else if (personalityType === 'playful') {
      // Use defaults
      return null;
    }
    
    return null;
  }
}


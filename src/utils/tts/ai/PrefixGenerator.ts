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

  constructor(personality?: PersonalityType) {
    this.cache = new PrefixCache(TTS_CONFIG.PREFIX_CACHE_SIZE);
    this.personality = personality;
  }

  /**
   * Initializes the DecisionMaker if needed
   */
  private ensureDecisionMaker(): void {
    if (!this.decisionMaker) {
      this.decisionMaker = new DecisionMaker();
    }
  }

  /**
   * Generates a prefix using AI
   */
  async generatePrefix(personality: Personality, context: string): Promise<string> {
    this.ensureDecisionMaker();

    // Check if AI is available
    if (!this.decisionMaker?.isEnabled()) {
      return this.getFallbackPrefix(personality);
    }

    // Create cache key
    const cacheKey = `${personality}:${context.substring(0, 20)}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
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
      const prefix = await this.callAIForPrefix(prompt);
      
      // Cache the result
      if (prefix) {
        this.cache.set(cacheKey, prefix);
        return prefix;
      }
      
      return this.getFallbackPrefix(personality);
    } catch (error) {
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
      const prompt = PromptBuilder.buildThinkingMessagePrompt(elementCount);
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
      
      if (provider === 'ollama') {
        const response = await fetch(process.env.OLLAMA_URL || 'http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: process.env.OLLAMA_MODEL || 'mistral',
            prompt: prompt,
            stream: false,
            options: { temperature: 0.8, num_predict: 10 }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const prefix = (data.response || '').trim().replace(/["']/g, '').split('\n')[0];
          return prefix || null;
        }
      } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 10
          })
        });

        if (response.ok) {
          const data = await response.json();
          const prefix = data.choices[0]?.message?.content?.trim().replace(/["']/g, '') || null;
          return prefix;
        }
      }
    } catch (error) {
      // Silently fail and use fallback
    }

    return null;
  }

  /**
   * Gets fallback prefix if AI is not available
   */
  private getFallbackPrefix(personality: Personality): string {
    const fallbacks = TTS_CONFIG.FALLBACK_PREFIXES[personality as keyof typeof TTS_CONFIG.FALLBACK_PREFIXES];
    if (!fallbacks) return '';
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}


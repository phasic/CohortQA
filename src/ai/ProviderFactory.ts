import { AIProvider } from './types.js';
import { AIClient, AIClientConfig } from './AIClient.js';
import { OpenAIClient } from './clients/OpenAIClient.js';
import { AnthropicClient } from './clients/AnthropicClient.js';
import { OllamaClient } from './clients/OllamaClient.js';
import { loadAIConfig } from '../config/ai-config.js';

export class ProviderFactory {
  /**
   * Detects the AI provider based on config.yaml first, then environment variables
   */
  static detectProvider(): AIProvider {
    // Priority 1: Explicit environment variable
    if (process.env.AI_PROVIDER || process.env.PLANNER_AI_PROVIDER) {
      return (process.env.AI_PROVIDER || process.env.PLANNER_AI_PROVIDER) as AIProvider;
    }
    
    // Priority 2: Check config.yaml
    const config = loadAIConfig();
    if (config.planner.provider) {
      return config.planner.provider;
    }
    
    // Priority 3: Auto-detect from environment variables (for backward compatibility)
    if (process.env.OPENAI_API_KEY) {
      return 'openai';
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      return 'anthropic';
    }
    
    // Default to Ollama (free, local)
    return 'ollama';
  }

  /**
   * Creates an AI client for the specified provider
   */
  static createClient(provider: AIProvider): AIClient | null {
    const config = this.getClientConfig(provider);
    if (!config) {
      return null;
    }

    switch (provider) {
      case 'openai':
        return new OpenAIClient(config);
      case 'anthropic':
        return new AnthropicClient(config);
      case 'ollama':
        return new OllamaClient(config);
      default:
        return null;
    }
  }

  /**
   * Gets the configuration for a specific provider
   */
  private static getClientConfig(provider: AIProvider): AIClientConfig | null {
    switch (provider) {
          case 'openai': {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) return null;
            
            const config = loadAIConfig();
            return {
              apiUrl: 'https://api.openai.com/v1/chat/completions',
              apiKey,
              model: config.planner.model || process.env.OPENAI_MODEL || process.env.PLANNER_AI_MODEL || 'gpt-4o-mini',
              temperature: 0.2, // Lower for faster, more deterministic responses
              maxTokens: 150 // Reduced - we only need elementIndex and brief reasoning
            };
          }
          
          case 'anthropic': {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) return null;
            
            const config = loadAIConfig();
            return {
              apiUrl: 'https://api.anthropic.com/v1/messages',
              apiKey,
              model: config.planner.model || process.env.ANTHROPIC_MODEL || process.env.PLANNER_AI_MODEL || 'claude-3-haiku-20240307',
              temperature: 0.2, // Lower for faster, more deterministic responses
              maxTokens: 150 // Reduced - we only need elementIndex and brief reasoning
            };
          }
      
      case 'ollama': {
        const config = loadAIConfig();
        const apiUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
        return {
          apiUrl,
          model: config.planner.model || process.env.OLLAMA_MODEL || process.env.PLANNER_AI_MODEL || 'mistral',
          temperature: 0.2 // Lower for faster, more deterministic responses
        };
      }
      
      default:
        return null;
    }
  }
}


import { AIProvider } from './types.js';
import { AIClient, AIClientConfig } from './AIClient.js';
import { OpenAIClient } from './clients/OpenAIClient.js';
import { AnthropicClient } from './clients/AnthropicClient.js';
import { OllamaClient } from './clients/OllamaClient.js';
import { loadAIConfig } from '../config/ai-config.js';

export class ProviderFactory {
  /**
   * Detects the AI provider for planner based on config.yaml first, then environment variables
   */
  static detectProvider(): AIProvider {
    // Priority 1: Explicit environment variable
    if (process.env.AI_PROVIDER || process.env.PLANNER_AI_PROVIDER) {
      const provider = (process.env.AI_PROVIDER || process.env.PLANNER_AI_PROVIDER)?.toLowerCase();
      if (provider === 'heuristic') {
        return 'heuristic';
      }
      return provider as AIProvider;
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
   * Detects the AI provider for generator based on config.yaml first, then environment variables
   */
  static detectGeneratorProvider(): AIProvider {
    // Priority 1: Explicit environment variable
    if (process.env.GENERATOR_AI_PROVIDER) {
      const provider = process.env.GENERATOR_AI_PROVIDER.toLowerCase();
      if (provider === 'heuristic') {
        return 'heuristic';
      }
      return provider as AIProvider;
    }
    
    // Priority 2: Check config.yaml
    const config = loadAIConfig();
    if (config.generator?.provider) {
      return config.generator.provider;
    }
    
    // Priority 3: Auto-detect from environment variables
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
   * Detects the AI provider for healer based on config.yaml first, then environment variables
   */
  static detectHealerProvider(): AIProvider {
    // Priority 1: Explicit environment variable
    if (process.env.HEALER_AI_PROVIDER) {
      const provider = process.env.HEALER_AI_PROVIDER.toLowerCase();
      if (provider === 'heuristic') {
        return 'heuristic';
      }
      return provider as AIProvider;
    }
    
    // Priority 2: Check config.yaml
    const config = loadAIConfig();
    if (config.healer?.provider) {
      return config.healer.provider;
    }
    
    // Priority 3: Auto-detect from environment variables
    if (process.env.OPENAI_API_KEY) {
      return 'openai';
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      return 'anthropic';
    }
    
    // Default to heuristic (conservative approach for healing)
    return 'heuristic';
  }

  /**
   * Creates an AI client for the specified provider
   */
  static createClient(provider: AIProvider): AIClient | null {
    // If provider is 'heuristic', return null to disable AI
    if (provider === 'heuristic') {
      return null;
    }
    
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
   * Gets the configuration for a specific provider (for planner)
   */
  private static getClientConfig(provider: AIProvider): AIClientConfig | null {
    return this.getClientConfigFor(provider, 'planner');
  }

  /**
   * Gets the configuration for a specific provider (for generator)
   */
  static getGeneratorClientConfig(provider: AIProvider): AIClientConfig | null {
    return this.getClientConfigFor(provider, 'generator');
  }

  /**
   * Gets the configuration for a specific provider (for healer)
   */
  static getHealerClientConfig(provider: AIProvider): AIClientConfig | null {
    return this.getClientConfigFor(provider, 'healer');
  }

  /**
   * Gets the configuration for a specific provider and component
   */
  private static getClientConfigFor(provider: AIProvider, component: 'planner' | 'generator' | 'healer'): AIClientConfig | null {
    // If provider is 'heuristic', return null to disable AI
    if (provider === 'heuristic') {
      return null;
    }
    
    switch (provider) {
          case 'openai': {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) return null;
            
            const config = loadAIConfig();
            const modelKey = component === 'generator' ? 'generator' : component === 'healer' ? 'healer' : 'planner';
            const defaultModel = component === 'generator' || component === 'healer' ? 'gpt-4o-mini' : 'gpt-4o-mini';
            const envModelKey = component === 'generator' ? 'GENERATOR_AI_MODEL' : component === 'healer' ? 'HEALER_AI_MODEL' : 'PLANNER_AI_MODEL';
            
            return {
              apiUrl: 'https://api.openai.com/v1/chat/completions',
              apiKey,
              model: (config as any)[modelKey]?.model || process.env.OPENAI_MODEL || process.env[envModelKey] || defaultModel,
              temperature: component === 'generator' || component === 'healer' ? 0.3 : 0.2, // Slightly higher for code generation/healing
              maxTokens: component === 'generator' || component === 'healer' ? 4000 : 150 // More tokens for code generation/healing
            };
          }
          
          case 'anthropic': {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) return null;
            
            const config = loadAIConfig();
            const modelKey = component === 'generator' ? 'generator' : component === 'healer' ? 'healer' : 'planner';
            const defaultModel = component === 'generator' || component === 'healer' ? 'claude-3-haiku-20240307' : 'claude-3-haiku-20240307';
            const envModelKey = component === 'generator' ? 'GENERATOR_AI_MODEL' : component === 'healer' ? 'HEALER_AI_MODEL' : 'PLANNER_AI_MODEL';
            
            return {
              apiUrl: 'https://api.anthropic.com/v1/messages',
              apiKey,
              model: (config as any)[modelKey]?.model || process.env.ANTHROPIC_MODEL || process.env[envModelKey] || defaultModel,
              temperature: component === 'generator' || component === 'healer' ? 0.3 : 0.2, // Slightly higher for code generation/healing
              maxTokens: component === 'generator' || component === 'healer' ? 4000 : 150 // More tokens for code generation/healing
            };
          }
      
      case 'ollama': {
        const config = loadAIConfig();
        const modelKey = component === 'generator' ? 'generator' : component === 'healer' ? 'healer' : 'planner';
        const defaultModel = component === 'generator' || component === 'healer' ? 'mistral' : 'mistral';
        const envModelKey = component === 'generator' ? 'GENERATOR_AI_MODEL' : component === 'healer' ? 'HEALER_AI_MODEL' : 'PLANNER_AI_MODEL';
        const apiUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
        return {
          apiUrl,
          model: (config as any)[modelKey]?.model || process.env.OLLAMA_MODEL || process.env[envModelKey] || defaultModel,
          temperature: component === 'generator' || component === 'healer' ? 0.3 : 0.2 // Slightly higher for code generation/healing
        };
      }
      
      default:
        return null;
    }
  }
}


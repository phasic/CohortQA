/**
 * Global AI configuration for Planner and TTS
 * Now loaded from config.yaml via config-loader
 */

import { getAIConfig } from './config-loader.js';

export type AIProvider = 'openai' | 'anthropic' | 'ollama' | 'heuristic';

export interface AIConfig {
  // Planner AI provider (for element selection)
  planner: {
    provider: AIProvider;
    // Optional: specific model override (if not set, uses defaults)
    model?: string;
  };
  
  // Generator AI provider (for test code generation)
  generator: {
    provider: AIProvider;
    // Optional: specific model override (if not set, uses defaults)
    model?: string;
  };
  
  // Healer AI provider (for test healing)
  healer: {
    provider: AIProvider;
    // Optional: specific model override (if not set, uses defaults)
    model?: string;
  };
  
  // TTS provider (for text-to-speech)
  tts: {
    provider: AIProvider | 'piper' | 'macos';
    // Optional: specific model override (if not set, uses defaults)
    model?: string;
    // Optional: voice override (for OpenAI TTS)
    voice?: string;
  };
}

/**
 * Loads AI configuration from config.yaml (with env var overrides)
 */
export function loadAIConfig(): AIConfig {
  return getAIConfig();
}


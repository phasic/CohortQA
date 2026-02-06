/**
 * Configuration constants for TTS
 * Now loaded from config.yaml via config-loader
 */
import { getTTSConfig } from '../../config/config-loader.js';

const config = getTTSConfig();

export const TTS_CONFIG = {
  // macOS say defaults
  MACOS_VOICE: config.macos.voice,
  MACOS_RATE: config.macos.rate,
  
  // OpenAI TTS defaults
  OPENAI_VOICE: config.openai.voice,
  OPENAI_MODEL: config.openai.model,
  
  // Piper TTS defaults
  PIPER_VOICE: config.piper.voice,
  
  // Cache settings
  PREFIX_CACHE_SIZE: config.prefixCacheSize,
  
  // Piper detection paths
  PIPER_PATHS: config.piper.paths,
  
  // Piper voice model paths (checked in order for auto-detection)
  PIPER_MODEL_PATHS: config.piper.modelPaths,
  
  // Piper voice shortcuts (maps friendly names to model paths)
  PIPER_VOICE_SHORTCUTS: config.piper.voiceShortcuts,
  
  // Fallback prefixes (used when AI is not available)
  FALLBACK_PREFIXES: config.fallbackPrefixes,
  
  // Fallback thinking messages
  FALLBACK_THINKING_MESSAGES: config.fallbackThinkingMessages,
} as const;


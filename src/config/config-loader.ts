import * as fs from 'fs';
import * as path from 'path';
import { load as loadYaml } from 'js-yaml';

export interface Config {
  ai: {
    planner: {
      provider: 'ollama' | 'openai' | 'anthropic';
      model?: string;
    };
    tts: {
      provider: 'openai' | 'piper' | 'macos';
      model?: string;
      voice?: string;
    };
  };
  planner: {
    maxClicks: number;
    maxConsecutiveFailures: number;
    elementWaitTimeout: number;
    clickTimeout: number;
    navigationWaitTimeout: number;
    pageSettleTimeout: number;
    recentInteractionHistorySize: number;
    maxElementsToShowAI: number;
    ignoredTags: string[];
  };
  tts: {
    macos: {
      voice: string;
      rate: number;
    };
    openai: {
      voice: string;
      model: string;
    };
    piper: {
      voice: string;
      paths: string[];
      modelPaths: string[];
      voiceShortcuts: Record<string, string>;
    };
    prefixCacheSize: number;
    fallbackPrefixes: {
      realizing: string[];
      deciding: string[];
      acting: string[];
    };
    fallbackThinkingMessages: string[];
  };
}

let cachedConfig: Config | null = null;

/**
 * Loads configuration from config.yaml file
 * Environment variables override YAML values
 */
export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.resolve(process.cwd(), 'config.yaml');
  
  let yamlConfig: any = {};
  
  try {
    if (fs.existsSync(configPath)) {
      const fileContents = fs.readFileSync(configPath, 'utf-8');
      yamlConfig = loadYaml(fileContents) as any;
    } else {
      console.warn(`⚠️  config.yaml not found at ${configPath}, using defaults`);
    }
  } catch (error: any) {
    console.warn(`⚠️  Error loading config.yaml: ${error.message}, using defaults`);
  }

  // Merge with environment variables (env vars take precedence)
  const config: Config = {
    ai: {
      planner: {
        provider: (process.env.PLANNER_AI_PROVIDER?.toLowerCase() as any) || 
                  yamlConfig.ai?.planner?.provider || 'ollama',
        model: process.env.PLANNER_AI_MODEL || 
               yamlConfig.ai?.planner?.model || undefined,
      },
      tts: {
        provider: (process.env.TTS_PROVIDER?.toLowerCase() as any) || 
                  yamlConfig.ai?.tts?.provider || 'openai',
        model: process.env.TTS_MODEL || 
               yamlConfig.ai?.tts?.model || undefined,
        voice: process.env.TTS_VOICE || 
               yamlConfig.ai?.tts?.voice || undefined,
      },
    },
    planner: {
      maxClicks: yamlConfig.planner?.maxClicks || 50,
      maxConsecutiveFailures: yamlConfig.planner?.maxConsecutiveFailures || 10,
      elementWaitTimeout: yamlConfig.planner?.elementWaitTimeout || 3000,
      clickTimeout: yamlConfig.planner?.clickTimeout || 5000,
      navigationWaitTimeout: yamlConfig.planner?.navigationWaitTimeout || 5000,
      pageSettleTimeout: yamlConfig.planner?.pageSettleTimeout || 800,
      recentInteractionHistorySize: yamlConfig.planner?.recentInteractionHistorySize || 50,
      maxElementsToShowAI: yamlConfig.planner?.maxElementsToShowAI || 20,
      ignoredTags: yamlConfig.planner?.ignoredTags || ['header', 'nav', 'aside', 'footer', 'dbs-top-bar'],
    },
    tts: {
      macos: {
        // Voice comes from ai.tts (single source of truth)
        voice: process.env.TTS_VOICE || yamlConfig.ai?.tts?.voice || yamlConfig.tts?.macos?.voice || 'Samantha',
        rate: yamlConfig.tts?.macos?.rate || 200,
      },
      openai: {
        // Model and voice come from ai.tts (single source of truth)
        voice: process.env.TTS_VOICE || yamlConfig.ai?.tts?.voice || yamlConfig.tts?.openai?.voice || 'nova',
        model: process.env.TTS_MODEL || yamlConfig.ai?.tts?.model || yamlConfig.tts?.openai?.model || 'tts-1',
      },
      piper: {
        // Voice comes from ai.tts (single source of truth)
        voice: process.env.PIPER_VOICE || yamlConfig.ai?.tts?.voice || yamlConfig.tts?.piper?.voice || 'amy',
        paths: yamlConfig.tts?.piper?.paths || [
          'piper',
          'piper-tts',
          '~/.local/bin/piper',
          '~/.local/bin/piper-tts',
          '~/.local/pipx/venvs/piper-tts/bin/piper',
          '~/.local/pipx/venvs/piper-tts/bin/piper-tts',
          '/usr/local/bin/piper',
          '/opt/homebrew/bin/piper',
        ],
        modelPaths: yamlConfig.tts?.piper?.modelPaths || [
          '~/.local/share/piper/voices/en/en_US/amy/medium/en_US-amy-medium.onnx',
          '~/.local/share/piper/voices/en/en_US/lessac/medium/en_US-lessac-medium.onnx',
          '~/.local/share/piper/voices/en/en_US/joe/medium/en_US-joe-medium.onnx',
        ],
        voiceShortcuts: yamlConfig.tts?.piper?.voiceShortcuts || {
          amy: '~/.local/share/piper/voices/en/en_US/amy/medium/en_US-amy-medium.onnx',
          lessac: '~/.local/share/piper/voices/en/en_US/lessac/medium/en_US-lessac-medium.onnx',
          joe: '~/.local/share/piper/voices/en/en_US/joe/medium/en_US-joe-medium.onnx',
        },
      },
      prefixCacheSize: yamlConfig.tts?.prefixCacheSize || 50,
      fallbackPrefixes: {
        realizing: yamlConfig.tts?.fallbackPrefixes?.realizing || [
          'Oh!', 'Hmm,', 'Interesting,', 'Look,', 'Hey,', 'Wow,', 'Nice,'
        ],
        deciding: yamlConfig.tts?.fallbackPrefixes?.deciding || [
          'I think', 'Let me try', 'Maybe', 'How about', 'I\'ll go with', 'Let\'s try'
        ],
        acting: yamlConfig.tts?.fallbackPrefixes?.acting || [
          'Clicking', 'Going for', 'Trying', 'Selecting', 'Picking', 'Choosing'
        ],
      },
      fallbackThinkingMessages: yamlConfig.tts?.fallbackThinkingMessages || [
        'Let me think which one to click',
        'Which one should I pick?',
        'Hmm, which one looks best?',
        'Let me pick the best one',
        'Which one should I try?',
        'Let me choose one',
        'Which one to go with?',
        'Let me decide which one',
      ],
    },
  };

  // Auto-detect TTS provider if OpenAI API key is set and TTS provider not explicitly set
  if (!process.env.TTS_PROVIDER && process.env.OPENAI_API_KEY) {
    config.ai.tts.provider = 'openai';
  }

  cachedConfig = config;
  return config;
}

/**
 * Gets the AI configuration
 */
export function getAIConfig() {
  return loadConfig().ai;
}

/**
 * Gets the planner configuration
 */
export function getPlannerConfig() {
  return loadConfig().planner;
}

/**
 * Gets the TTS configuration
 */
export function getTTSConfig() {
  return loadConfig().tts;
}


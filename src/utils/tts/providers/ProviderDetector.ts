import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TTSProvider } from '../types.js';
import { TTS_CONFIG } from '../config.js';
import { loadAIConfig } from '../../../config/ai-config.js';

const execAsync = promisify(exec);

export interface ProviderInfo {
  provider: TTSProvider;
  piperPath?: string | null;
  piperModelPath?: string | null;
  openaiApiKey?: string | null;
}

/**
 * Detects which TTS provider to use and finds provider-specific paths
 */
export class ProviderDetector {
  /**
   * Detects the best available TTS provider
   * Uses TTS_PROVIDER env var or config, then auto-detects
   */
  static async detectProvider(): Promise<ProviderInfo> {
    // Check environment variable first (highest priority for runtime overrides)
    const envProvider = process.env.TTS_PROVIDER?.toLowerCase();
    const config = loadAIConfig();
    const ttsProvider = envProvider || config.tts.provider;
    
    // If TTS provider is explicitly set to OpenAI, check for API key
    if (ttsProvider === 'openai') {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (openaiApiKey) {
        return {
          provider: 'openai',
          openaiApiKey
        };
      } else {
        console.warn('⚠️  TTS provider set to OpenAI but OPENAI_API_KEY not found. Falling back to other providers.');
      }
    }
    
    // If TTS provider is explicitly set to macOS, use it
    if (ttsProvider === 'macos') {
      return {
        provider: 'macos'
      };
    }
    
    // If TTS provider is explicitly set to Piper, check for Piper
    if (ttsProvider === 'piper') {
      const piperInfo = await this.detectPiper();
      if (piperInfo.available) {
        // Check for explicit model path via environment variable or config
        let modelPath = piperInfo.modelPath;
        
        // Priority 1: PIPER_MODEL_PATH environment variable (full path)
        if (process.env.PIPER_MODEL_PATH) {
          const envPath = process.env.PIPER_MODEL_PATH.startsWith('~')
            ? process.env.PIPER_MODEL_PATH.replace('~', os.homedir())
            : process.env.PIPER_MODEL_PATH;
          try {
            await fs.access(envPath);
            modelPath = envPath;
            console.log(`🔊 Using Piper voice from PIPER_MODEL_PATH: ${envPath}`);
          } catch {
            console.warn(`⚠️  PIPER_MODEL_PATH not found: ${envPath}, using auto-detected: ${modelPath}`);
          }
        }
        // Priority 2: PIPER_VOICE environment variable (shortcut name)
        else if (process.env.PIPER_VOICE) {
          const voiceName = process.env.PIPER_VOICE.toLowerCase();
          const shortcutPath = TTS_CONFIG.PIPER_VOICE_SHORTCUTS[voiceName as keyof typeof TTS_CONFIG.PIPER_VOICE_SHORTCUTS];
          if (shortcutPath) {
            const expandedPath = shortcutPath.startsWith('~')
              ? shortcutPath.replace('~', os.homedir())
              : shortcutPath;
            try {
              await fs.access(expandedPath);
              modelPath = expandedPath;
              console.log(`🔊 Using Piper voice from PIPER_VOICE env: ${voiceName} (${expandedPath})`);
            } catch {
              console.warn(`⚠️  PIPER_VOICE env '${voiceName}' not found at ${expandedPath}, using auto-detected: ${modelPath}`);
            }
          } else {
            console.warn(`⚠️  Unknown PIPER_VOICE env value: ${voiceName}, using auto-detected: ${modelPath}`);
          }
        }
        // Priority 3: TTS_CONFIG.PIPER_VOICE (config file setting)
        else if (TTS_CONFIG.PIPER_VOICE) {
          const voiceName = TTS_CONFIG.PIPER_VOICE.toLowerCase();
          // Check if it's a shortcut name
          const shortcutPath = TTS_CONFIG.PIPER_VOICE_SHORTCUTS[voiceName as keyof typeof TTS_CONFIG.PIPER_VOICE_SHORTCUTS];
          if (shortcutPath) {
            const expandedPath = shortcutPath.startsWith('~')
              ? shortcutPath.replace('~', os.homedir())
              : shortcutPath;
            try {
              await fs.access(expandedPath);
              modelPath = expandedPath;
              console.log(`🔊 Using Piper voice from config: ${voiceName} (${expandedPath})`);
            } catch (error) {
              console.warn(`⚠️  Config voice '${voiceName}' not found at ${expandedPath}, using auto-detected: ${modelPath}`);
              console.warn(`   Make sure the voice model is installed at: ${expandedPath}`);
            }
          } else {
            // Assume it's a full path
            const expandedPath = TTS_CONFIG.PIPER_VOICE.startsWith('~')
              ? TTS_CONFIG.PIPER_VOICE.replace('~', os.homedir())
              : TTS_CONFIG.PIPER_VOICE;
            try {
              await fs.access(expandedPath);
              modelPath = expandedPath;
              console.log(`🔊 Using Piper voice from config: ${expandedPath}`);
            } catch (error) {
              console.warn(`⚠️  Config voice path not found: ${expandedPath}, using auto-detected: ${modelPath}`);
            }
          }
        } else {
          // No explicit voice setting, use auto-detected
          if (modelPath) {
            console.log(`🔊 Using auto-detected Piper voice: ${modelPath}`);
          }
        }
        
        return {
          provider: 'piper',
          piperPath: piperInfo.path,
          piperModelPath: modelPath
        };
      } else {
        console.warn('⚠️  TTS provider set to Piper but Piper not found. Falling back to other providers.');
      }
    }
    
    // Auto-detect: Check for OpenAI API key first (highest priority)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey && (ttsProvider === 'openai' || ttsProvider === undefined)) {
      return {
        provider: 'openai',
        openaiApiKey
      };
    }
    
    // Auto-detect: Check for Piper TTS
    const piperInfo = await this.detectPiper();
    if (piperInfo.available) {
      // Check for explicit model path via environment variable or config
      let modelPath = piperInfo.modelPath;
      
      // Priority 1: PIPER_MODEL_PATH environment variable (full path)
      if (process.env.PIPER_MODEL_PATH) {
        const envPath = process.env.PIPER_MODEL_PATH.startsWith('~')
          ? process.env.PIPER_MODEL_PATH.replace('~', os.homedir())
          : process.env.PIPER_MODEL_PATH;
        try {
          await fs.access(envPath);
          modelPath = envPath;
          console.log(`🔊 Using Piper voice from PIPER_MODEL_PATH: ${envPath}`);
        } catch {
          console.warn(`⚠️  PIPER_MODEL_PATH not found: ${envPath}, using auto-detected: ${modelPath}`);
        }
      }
      // Priority 2: PIPER_VOICE environment variable (shortcut name)
      else if (process.env.PIPER_VOICE) {
        const voiceName = process.env.PIPER_VOICE.toLowerCase();
        const shortcutPath = TTS_CONFIG.PIPER_VOICE_SHORTCUTS[voiceName as keyof typeof TTS_CONFIG.PIPER_VOICE_SHORTCUTS];
        if (shortcutPath) {
          const expandedPath = shortcutPath.startsWith('~')
            ? shortcutPath.replace('~', os.homedir())
            : shortcutPath;
          try {
            await fs.access(expandedPath);
            modelPath = expandedPath;
            console.log(`🔊 Using Piper voice from PIPER_VOICE env: ${voiceName} (${expandedPath})`);
          } catch {
            console.warn(`⚠️  PIPER_VOICE env '${voiceName}' not found at ${expandedPath}, using auto-detected: ${modelPath}`);
          }
        } else {
          console.warn(`⚠️  Unknown PIPER_VOICE env value: ${voiceName}, using auto-detected: ${modelPath}`);
        }
      }
      // Priority 3: TTS_CONFIG.PIPER_VOICE (config file setting)
      else if (TTS_CONFIG.PIPER_VOICE) {
        const voiceName = TTS_CONFIG.PIPER_VOICE.toLowerCase();
        // Check if it's a shortcut name
        const shortcutPath = TTS_CONFIG.PIPER_VOICE_SHORTCUTS[voiceName as keyof typeof TTS_CONFIG.PIPER_VOICE_SHORTCUTS];
        if (shortcutPath) {
          const expandedPath = shortcutPath.startsWith('~')
            ? shortcutPath.replace('~', os.homedir())
            : shortcutPath;
          try {
            await fs.access(expandedPath);
            modelPath = expandedPath;
            console.log(`🔊 Using Piper voice from config: ${voiceName} (${expandedPath})`);
          } catch (error) {
            console.warn(`⚠️  Config voice '${voiceName}' not found at ${expandedPath}, using auto-detected: ${modelPath}`);
            console.warn(`   Make sure the voice model is installed at: ${expandedPath}`);
          }
        } else {
          // Assume it's a full path
          const expandedPath = TTS_CONFIG.PIPER_VOICE.startsWith('~')
            ? TTS_CONFIG.PIPER_VOICE.replace('~', os.homedir())
            : TTS_CONFIG.PIPER_VOICE;
          try {
            await fs.access(expandedPath);
            modelPath = expandedPath;
            console.log(`🔊 Using Piper voice from config: ${expandedPath}`);
          } catch (error) {
            console.warn(`⚠️  Config voice path not found: ${expandedPath}, using auto-detected: ${modelPath}`);
          }
        }
      } else {
        // No explicit voice setting, use auto-detected
        if (modelPath) {
          console.log(`🔊 Using auto-detected Piper voice: ${modelPath}`);
        }
      }
      
      return {
        provider: 'piper',
        piperPath: piperInfo.path,
        piperModelPath: modelPath
      };
    }
    
    // Fallback to macOS
    return {
      provider: 'macos'
    };
  }

  /**
   * Detects if Piper TTS is available
   */
  private static async detectPiper(): Promise<{ available: boolean; path: string | null; modelPath: string | null }> {
    const possiblePiperPaths = TTS_CONFIG.PIPER_PATHS.map(p => 
      p.startsWith('~') ? p.replace('~', os.homedir()) : p
    );

    let foundPiperPath: string | null = null;

    // Try to find piper executable
    for (const piperPath of possiblePiperPaths) {
      try {
        if (piperPath === 'piper' || piperPath === 'piper-tts') {
          // Use 'which' for PATH lookup
          await execAsync(`which ${piperPath}`);
          foundPiperPath = piperPath;
          break;
        } else {
          // Check if file exists
          await fs.access(piperPath);
          foundPiperPath = piperPath;
          break;
        }
      } catch {
        // Try next path
        continue;
      }
    }

    if (!foundPiperPath) {
      return { available: false, path: null, modelPath: null };
    }

    // Try to find a voice model
    const possibleModelPaths = TTS_CONFIG.PIPER_MODEL_PATHS.map(p =>
      p.startsWith('~') ? p.replace('~', os.homedir()) : p
    );

    for (const modelPath of possibleModelPaths) {
      try {
        await fs.access(modelPath);
        return { available: true, path: foundPiperPath, modelPath };
      } catch {
        // Try next path
        continue;
      }
    }

    // Piper is available but no model found
    return { available: true, path: foundPiperPath, modelPath: null };
  }
}


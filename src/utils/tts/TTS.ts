import { TTSProvider, Personality } from './types.js';
import { TTS_CONFIG } from './config.js';
import { ProviderDetector, ProviderInfo } from './providers/ProviderDetector.js';
import { MacOSProvider } from './providers/MacOSProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { PiperProvider } from './providers/PiperProvider.js';
import { PrefixGenerator } from './ai/PrefixGenerator.js';
import { loadAIConfig } from '../../config/ai-config.js';
import * as os from 'os';

/**
 * Text-to-Speech utility for AI personality
 * Supports OpenAI TTS, Piper TTS (free, offline), or macOS 'say' command (fallback)
 */
export class TTS {
  private enabled: boolean = false;
  private provider: TTSProvider = 'macos';
  private providerInfo: ProviderInfo | null = null;
  private macosProvider: MacOSProvider | null = null;
  private openaiProvider: OpenAIProvider | null = null;
  private piperProvider: PiperProvider | null = null;
  private prefixGenerator: PrefixGenerator;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
    this.prefixGenerator = new PrefixGenerator();
    
    // Start detecting provider in background (non-blocking)
    this.detectAndInitializeProvider().catch(() => {
      // Silently fail, will use macOS say
    });
  }

  /**
   * Detects and initializes the TTS provider
   */
  private async detectAndInitializeProvider(): Promise<void> {
    this.providerInfo = await ProviderDetector.detectProvider();
    this.provider = this.providerInfo.provider;

    // Get voice from environment variable (set by frontend) or config
    const voice = process.env.TTS_VOICE || undefined;
    
    // Debug: Log what provider and voice we're using
    console.log(`🔊 TTS Provider: ${this.provider}${voice ? `, Voice: ${voice}` : ''}`);

    // Initialize provider-specific implementations
    if (this.provider === 'openai' && this.providerInfo.openaiApiKey) {
      this.openaiProvider = new OpenAIProvider(this.providerInfo.openaiApiKey, voice);
    } else if (this.provider === 'piper' && this.providerInfo.piperPath) {
      this.piperProvider = new PiperProvider(
        this.providerInfo.piperPath,
        this.providerInfo.piperModelPath || null
      );
      
      // Debug: Log what we found
      if (this.providerInfo.piperModelPath) {
        console.log(`🔊 Piper TTS detected at: ${this.providerInfo.piperPath} (model: ${this.providerInfo.piperModelPath})`);
      }
    } else {
      // macOS provider - use voice from env var if set
      this.macosProvider = new MacOSProvider(voice);
      if (voice) {
        console.log(`🔊 Using macOS voice: ${voice}`);
      }
    }
  }

  /**
   * Speaks text with AI personality
   */
  async speak(text: string, personality: Personality = 'thinking'): Promise<void> {
    if (!this.enabled) return;

    try {
      // Ensure provider is initialized
      if (!this.providerInfo) {
        await this.detectAndInitializeProvider();
      }

      // Add dynamic personality prefixes based on context (AI-generated)
      let speechText = text;
      
      if (personality !== 'thinking') {
        const prefix = await this.prefixGenerator.generatePrefix(personality, text);
        if (prefix) {
          speechText = `${prefix} ${text}`;
        }
      }

      // Ensure providers are initialized
      if (this.provider === 'openai' && !this.openaiProvider && this.providerInfo?.openaiApiKey) {
        this.openaiProvider = new OpenAIProvider(this.providerInfo.openaiApiKey);
      } else if (this.provider === 'piper' && !this.piperProvider && this.providerInfo?.piperPath) {
        this.piperProvider = new PiperProvider(
          this.providerInfo.piperPath,
          this.providerInfo.piperModelPath || null
        );
      } else if (this.provider === 'macos' && !this.macosProvider) {
        this.macosProvider = new MacOSProvider();
      }

      // Speak using the appropriate provider
      if (this.provider === 'openai' && this.openaiProvider) {
        try {
          await this.openaiProvider.speak(speechText);
        } catch (error: any) {
          // Fallback to macOS if OpenAI fails
          console.warn(`OpenAI TTS failed: ${error.message}, falling back to macOS say`);
          if (!this.macosProvider) {
            this.macosProvider = new MacOSProvider();
          }
          await this.macosProvider.speak(speechText);
          this.provider = 'macos';
        }
      } else if (this.provider === 'piper' && this.piperProvider) {
        try {
          await this.piperProvider.speak(speechText);
        } catch (error: any) {
          // Fallback to macOS if Piper fails
          const errorOutput = error.stderr || error.stdout || '';
          
          if (errorOutput.includes('ModuleNotFoundError') || errorOutput.includes('No module named')) {
            console.warn(`⚠️  Piper TTS has missing dependencies. Try reinstalling:`);
            console.warn(`   pipx reinstall piper-tts`);
            console.warn(`   Or install the binary version from: https://github.com/rhasspy/piper/releases`);
          } else {
            console.warn(`Piper TTS failed: ${error.message}`);
            if (errorOutput) {
              console.warn(`Piper TTS error output: ${errorOutput.substring(0, 200)}`);
            }
          }
          
          console.warn(`Falling back to macOS say...`);
          if (!this.macosProvider) {
            this.macosProvider = new MacOSProvider();
          }
          await this.macosProvider.speak(speechText);
          this.provider = 'macos';
        }
      } else {
        // macOS fallback
        if (!this.macosProvider) {
          this.macosProvider = new MacOSProvider();
        }
        await this.macosProvider.speak(speechText);
      }
    } catch (error) {
      // Silently fail if TTS is not available
    }
  }

  /**
   * Speaks AI reasoning in a natural, thinking-out-loud way
   */
  async speakReasoning(reasoning: string): Promise<void> {
    if (!this.enabled) return;

    // Clean up the reasoning text for speech
    let cleanText = reasoning
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italics
      .replace(/`/g, '') // Remove code blocks
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Keep it short and snappy - max 50 characters
    if (cleanText.length > 50) {
      const firstSentence = cleanText.split(/[.!?]/)[0];
      cleanText = firstSentence.length > 0 && firstSentence.length <= 50 
        ? firstSentence 
        : cleanText.substring(0, 47) + '...';
    }

    await this.speak(cleanText, 'thinking');
  }

  /**
   * Speaks when AI is analyzing the page
   */
  async speakAnalysis(elementCount: number, url: string): Promise<void> {
    if (!this.enabled) return;
    
    await this.speak(`${elementCount} elements found`, 'realizing');
    
    // Add a follow-up thinking message (AI-generated)
    const thinkingMessage = await this.prefixGenerator.generateThinkingMessage(elementCount);
    if (thinkingMessage) {
      await this.speak(thinkingMessage, 'thinking');
    }
  }

  /**
   * Speaks when AI makes a decision
   */
  async speakDecision(elementText: string, reasoning: string): Promise<void> {
    if (!this.enabled) return;

    const shortElement = (elementText || 'this').substring(0, 30);
    // Use 'acting' personality for the final click action
    await this.speak(shortElement, 'acting');
  }

  /**
   * Speaks when taking action
   */
  async speakAction(action: string): Promise<void> {
    if (!this.enabled) return;
    // Keep action messages short - just the key part
    const shortAction = action.length > 30 ? action.substring(0, 27) + '...' : action;
    await this.speak(shortAction, 'acting');
  }

  /**
   * Sets the voice (macOS voices: Samantha, Alex, Victoria, etc.)
   * Only used when provider is 'macos'
   */
  setVoice(voice: string): void {
    if (this.macosProvider) {
      this.macosProvider.setVoice(voice);
    }
  }

  /**
   * Sets the OpenAI voice (alloy, echo, fable, onyx, nova, shimmer)
   * Only used when provider is 'openai'
   */
  setOpenAIVoice(voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'): void {
    if (this.openaiProvider) {
      this.openaiProvider.setVoice(voice);
    }
  }

  /**
   * Sets the speech rate (words per minute, default 200)
   * Only used when provider is 'macos'
   */
  setRate(rate: number): void {
    if (this.macosProvider) {
      this.macosProvider.setRate(rate);
    }
  }

  /**
   * Gets the current TTS provider
   */
  getProvider(): TTSProvider {
    return this.provider;
  }

  /**
   * Gets provider info including model/voice details
   */
  async getProviderInfo(): Promise<{ provider: TTSProvider; model?: string; voice?: string }> {
    // Ensure provider is detected and initialized
    if (!this.providerInfo) {
      await this.detectAndInitializeProvider();
    }

    // Get voice from environment variable (set by frontend) or config
    const voice = process.env.TTS_VOICE || undefined;
    
    // Ensure providers are initialized
    if (this.provider === 'openai' && !this.openaiProvider && this.providerInfo?.openaiApiKey) {
      this.openaiProvider = new OpenAIProvider(this.providerInfo.openaiApiKey, voice);
    } else if (this.provider === 'piper' && !this.piperProvider && this.providerInfo?.piperPath) {
      this.piperProvider = new PiperProvider(
        this.providerInfo.piperPath,
        this.providerInfo.piperModelPath || null
      );
    } else if (this.provider === 'macos' && !this.macosProvider) {
      this.macosProvider = new MacOSProvider(voice);
    }

    const info: { provider: TTSProvider; model?: string; voice?: string } = {
      provider: this.provider
    };

    if (this.provider === 'openai' && this.openaiProvider) {
      // Access private properties via type assertion
      const openai = this.openaiProvider as any;
      info.model = openai.model || 'tts-1';
      info.voice = openai.voice || 'nova';
    } else if (this.provider === 'piper' && this.providerInfo?.piperModelPath) {
      // Extract voice name from path (e.g., en_US-amy-medium.onnx -> amy)
      const modelPath = this.providerInfo.piperModelPath;
      const match = modelPath.match(/([^/]+)\.onnx$/);
      if (match) {
        const parts = match[1].split('-');
        info.voice = parts.length > 1 ? parts[parts.length - 2] : parts[0];
      }
      info.model = modelPath;
    } else if (this.provider === 'macos' && this.macosProvider) {
      const macos = this.macosProvider as any;
      info.voice = macos.voice || 'Samantha';
    }

    return info;
  }

  /**
   * Sets the Piper model path manually (full path to .onnx file)
   */
  setPiperModel(modelPath: string): void {
    if (this.piperProvider) {
      this.piperProvider.setModelPath(modelPath);
    } else if (this.providerInfo?.piperPath) {
      this.piperProvider = new PiperProvider(this.providerInfo.piperPath, modelPath);
      this.provider = 'piper';
    }
  }

  /**
   * Sets the Piper voice using a shortcut name (e.g., 'amy', 'lessac', 'joe')
   * Or you can use setPiperModel() with the full path to any .onnx file
   */
  setPiperVoice(voiceName: 'amy' | 'lessac' | 'joe' | string): void {
    const shortcutPath = TTS_CONFIG.PIPER_VOICE_SHORTCUTS[voiceName.toLowerCase() as keyof typeof TTS_CONFIG.PIPER_VOICE_SHORTCUTS];
    
    if (shortcutPath) {
      // Expand ~ to home directory
      const modelPath = shortcutPath.startsWith('~')
        ? shortcutPath.replace('~', os.homedir())
        : shortcutPath;
      this.setPiperModel(modelPath);
    } else {
      // If not a shortcut, assume it's a full path
      this.setPiperModel(voiceName);
    }
  }
}


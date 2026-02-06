/**
 * Type definitions for TTS module
 */

export type TTSProvider = 'openai' | 'piper' | 'macos';

export type Personality = 'thinking' | 'realizing' | 'deciding' | 'acting';

export interface TTSConfig {
  enabled: boolean;
  provider: TTSProvider;
  voice?: string;
  rate?: number;
  openaiApiKey?: string | null;
  openaiVoice?: string;
  piperPath?: string | null;
  piperModelPath?: string | null;
}


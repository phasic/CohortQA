import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TTS_CONFIG } from '../config.js';
import { loadAIConfig } from '../../../config/ai-config.js';

const execAsync = promisify(exec);

/**
 * OpenAI TTS API provider
 */
export class OpenAIProvider {
  private apiKey: string;
  private voice: string;
  private model: string;

  constructor(apiKey: string, voice?: string, model?: string) {
    this.apiKey = apiKey;
    const config = loadAIConfig();
    this.voice = voice || config.tts.voice || process.env.TTS_VOICE || TTS_CONFIG.OPENAI_VOICE;
    this.model = model || config.tts.model || process.env.TTS_MODEL || TTS_CONFIG.OPENAI_MODEL;
  }

  /**
   * Speaks text using OpenAI TTS API
   */
  async speak(text: string): Promise<void> {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          voice: this.voice,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`OpenAI TTS API error: ${response.status} ${errorText}`);
      }

      // Get audio data
      const audioBuffer = await response.arrayBuffer();
      
      // Save to temporary file
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `tts-${Date.now()}.mp3`);
      await fs.writeFile(tempFile, Buffer.from(audioBuffer));

      // Play audio using macOS 'afplay' command
      await execAsync(`afplay "${tempFile}"`);

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {
        // Ignore cleanup errors
      });
    } catch (error: any) {
      // If OpenAI TTS fails, throw to allow fallback
      throw error;
    }
  }

  /**
   * Sets the OpenAI voice
   */
  setVoice(voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'): void {
    this.voice = voice;
  }
}


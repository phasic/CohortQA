import { exec } from 'child_process';
import { promisify } from 'util';
import { TTS_CONFIG } from '../config.js';

const execAsync = promisify(exec);

/**
 * macOS 'say' command provider
 */
export class MacOSProvider {
  private voice: string;
  private rate: number;

  constructor(voice?: string, rate?: number) {
    this.voice = voice || TTS_CONFIG.MACOS_VOICE;
    this.rate = rate || TTS_CONFIG.MACOS_RATE;
  }

  /**
   * Speaks text using macOS 'say' command
   */
  async speak(text: string): Promise<void> {
    const escapedText = text.replace(/"/g, '\\"');
    await execAsync(`say -r ${this.rate} -v ${this.voice} "${escapedText}"`);
  }

  /**
   * Sets the voice
   */
  setVoice(voice: string): void {
    this.voice = voice;
  }

  /**
   * Sets the speech rate
   */
  setRate(rate: number): void {
    this.rate = rate;
  }
}


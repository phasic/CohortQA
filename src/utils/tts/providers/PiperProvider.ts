import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Piper TTS provider (free, offline, natural voice)
 */
export class PiperProvider {
  private piperPath: string;
  private modelPath: string | null;

  constructor(piperPath: string, modelPath: string | null = null) {
    this.piperPath = piperPath;
    this.modelPath = modelPath;
  }

  /**
   * Speaks text using Piper TTS
   */
  async speak(text: string): Promise<void> {
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `tts-piper-${Date.now()}.wav`);
    
    // Escape text for shell
    const escapedText = text.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`').replace(/\n/g, ' ');
    
    // Try multiple command formats (piper-tts package vs binary piper)
    const commandsToTry = [];
    
    if (this.modelPath) {
      // Format 1: Binary piper with pipe (most common)
      commandsToTry.push(`echo "${escapedText}" | ${this.piperPath} --model "${this.modelPath}" --output_file "${tempFile}"`);
      // Format 2: Try with --output instead of --output_file
      commandsToTry.push(`echo "${escapedText}" | ${this.piperPath} --model "${this.modelPath}" --output "${tempFile}"`);
      // Format 3: Python package style (piper-tts)
      commandsToTry.push(`${this.piperPath} --text "${escapedText}" --output "${tempFile}" --model "${this.modelPath}"`);
    } else {
      // Without model path
      commandsToTry.push(`echo "${escapedText}" | ${this.piperPath} --output_file "${tempFile}"`);
      commandsToTry.push(`echo "${escapedText}" | ${this.piperPath} --output "${tempFile}"`);
      commandsToTry.push(`${this.piperPath} --text "${escapedText}" --output "${tempFile}"`);
    }

    let lastError: any = null;
    let commandSucceeded = false;

    // Try each command format until one works
    for (const piperCommand of commandsToTry) {
      try {
        await execAsync(piperCommand, { timeout: 10000 });
        
        // Check if file was created
        try {
          await fs.access(tempFile);
          commandSucceeded = true;
          break; // Success!
        } catch {
          // File not created, try next command format
          continue;
        }
      } catch (error: any) {
        lastError = error;
        // Try next command format
        continue;
      }
    }

    if (!commandSucceeded) {
      throw lastError || new Error('All Piper command formats failed');
    }

    // Check if file was created and play it
    try {
      await fs.access(tempFile);
      // Play the generated audio file
      await execAsync(`afplay "${tempFile}"`);
      
      // Clean up temp file after a short delay (to ensure playback started)
      setTimeout(async () => {
        await fs.unlink(tempFile).catch(() => {
          // Ignore cleanup errors
        });
      }, 1000);
    } catch {
      throw new Error('Piper did not generate audio file');
    }
  }

  /**
   * Sets the model path
   */
  setModelPath(modelPath: string): void {
    this.modelPath = modelPath;
  }
}


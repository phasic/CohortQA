/**
 * Utility for stripping ANSI escape codes from text
 */

export class AnsiCodeStripper {
  /**
   * Removes ANSI escape codes from text
   */
  static strip(text: string): string {
    return this.stripAnsiCodes(text);
  }

  /**
   * Removes ANSI escape codes from text (alias for strip)
   */
  static stripAnsiCodes(text: string): string {
    if (!text) return '';
    // Remove ANSI escape codes (colors, formatting, etc.)
    // Handle both \u001b and actual escape sequences
    return text
      .replace(/\u001b\[[0-9;]*m/g, '')  // Remove color codes like [2m, [31m, etc.
      .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')  // Remove other escape sequences
      .replace(/\x1b\[[0-9;]*m/g, '')  // Handle \x1b format
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')  // Handle other \x1b sequences
      .replace(/\[2m/g, '')  // Remove [2m (dim)
      .replace(/\[22m/g, '')  // Remove [22m (reset)
      .replace(/\[31m/g, '')  // Remove [31m (red)
      .replace(/\[32m/g, '')  // Remove [32m (green)
      .replace(/\[39m/g, '')  // Remove [39m (default foreground)
      .replace(/\[7m/g, '')  // Remove [7m (reverse)
      .replace(/\[27m/g, '')  // Remove [27m (reset reverse)
      .trim();
  }
}


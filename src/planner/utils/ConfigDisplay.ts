import chalk from 'chalk';

/**
 * Utility for displaying configuration information in a nice boxed format
 */
export class ConfigDisplay {
  /**
   * Prints a nice boxed configuration display
   */
  static printConfigBox(
    aiProvider: string | null,
    aiModel: string | null,
    ttsInfo: { provider: string; model?: string; voice?: string } | null
  ): void {
    const width = 60;
    const topBorder = '╔' + '═'.repeat(width - 2) + '╗';
    const bottomBorder = '╚' + '═'.repeat(width - 2) + '╝';
    const sideBorder = '║';
    const emptyLine = sideBorder + ' '.repeat(width - 2) + sideBorder;

    console.log('\n' + chalk.cyan(topBorder));
    console.log(chalk.cyan(sideBorder) + chalk.bold.white('  🤖 Planner Configuration'.padEnd(width - 3)) + chalk.cyan(sideBorder));
    console.log(chalk.cyan(emptyLine));

    // AI Decision Making
    if (aiProvider === 'heuristic') {
      const line = `  Decision Making: ${chalk.bold.yellow('Heuristics (AI disabled)')}`;
      console.log(chalk.cyan(sideBorder) + line.padEnd(width - 3) + chalk.cyan(sideBorder));
    } else if (aiProvider && aiModel) {
      const providerName =
        aiProvider === 'ollama'
          ? 'Ollama'
          : aiProvider === 'openai'
            ? 'OpenAI'
            : aiProvider === 'anthropic'
              ? 'Anthropic'
              : aiProvider;
      const line = `  Decision Making: ${chalk.bold.green(providerName)} (${chalk.yellow(aiModel)})`;
      console.log(chalk.cyan(sideBorder) + line.padEnd(width - 3) + chalk.cyan(sideBorder));
    } else {
      const line = `  Decision Making: ${chalk.dim('Heuristics (AI not available)')}`;
      console.log(chalk.cyan(sideBorder) + line.padEnd(width - 3) + chalk.cyan(sideBorder));
    }

    // TTS
    if (ttsInfo) {
      let ttsLine = `  Text-to-Speech: ${chalk.bold.green(
        ttsInfo.provider === 'openai' ? 'OpenAI' : ttsInfo.provider === 'piper' ? 'Piper' : 'macOS'
      )}`;
      if (ttsInfo.provider === 'openai' && ttsInfo.model && ttsInfo.voice) {
        ttsLine += ` (${chalk.yellow(ttsInfo.model)} / ${chalk.yellow(ttsInfo.voice)})`;
      } else if (ttsInfo.provider === 'piper' && ttsInfo.voice) {
        ttsLine += ` (${chalk.yellow(ttsInfo.voice)})`;
      } else if (ttsInfo.provider === 'macos' && ttsInfo.voice) {
        ttsLine += ` (${chalk.yellow(ttsInfo.voice)})`;
      }
      console.log(chalk.cyan(sideBorder) + ttsLine.padEnd(width - 3) + chalk.cyan(sideBorder));
    } else {
      const line = `  Text-to-Speech: ${chalk.dim('Disabled')}`;
      console.log(chalk.cyan(sideBorder) + line.padEnd(width - 3) + chalk.cyan(sideBorder));
    }

    console.log(chalk.cyan(bottomBorder) + '\n');
  }
}


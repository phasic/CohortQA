#!/usr/bin/env node

// Load environment variables from .env file (if it exists)
import { readFileSync } from 'fs';
import { resolve } from 'path';
try {
  const envPath = resolve(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  const envLines = envContent.split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Parse KEY=VALUE format
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Only set if not already set (env vars take precedence)
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
} catch (error) {
  // .env file doesn't exist or can't be read, that's okay
  // User can set environment variables manually or create .env file
}

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Planner } from './planner/Planner.js';
import { Generator } from './generator.js';
import { Healer } from './healer.js';

const program = new Command();

program
  .name('cohort-qa')
  .description('CLI wrapper for Playwright Test Agents (planner, generator, healer)')
  .version('1.0.0');

// Note: The 'init' command has been removed as we use custom Planner/Generator/Healer implementations
// instead of Playwright's built-in agent system

program
  .command('plan')
  .description('🎭 Planner: Explore app and generate Markdown test plan')
  .requiredOption('-u, --url <url>', 'URL to explore')
  .option('-o, --output <path>', 'Output path for markdown plan', './specs/test-plan.md')
  .option('-s, --seed <path>', 'Path to seed test file (default: tests/seed/seed.spec.ts)')
  .option('-n, --navigations <number>', 'Maximum number of page navigations to perform', '3')
  .option('--ai', 'Use AI to make smarter interaction decisions (requires OPENAI_API_KEY or ANTHROPIC_API_KEY)')
  .option('--tts', 'Enable text-to-speech for AI personality (macOS only)', false)
  .action(async (options) => {
    const spinner = ora('Initializing planner...').start();
    
    try {
      const planner = new Planner();
      await planner.initialize(options.ai, options.tts);
      
      const maxNavigations = parseInt(options.navigations) || 3;
      spinner.text = `Exploring ${options.url} (will navigate up to ${maxNavigations} pages)...`;
      
      // Default seed path to tests/seed/seed.spec.ts if not provided
      const seedPath = options.seed || 'tests/seed/seed.spec.ts';
      const plan = await planner.explore(options.url, seedPath, maxNavigations, options.ai, options.tts);
      
      spinner.text = 'Generating markdown test plan...';
      const outputPath = await planner.saveMarkdown(plan, options.output);
      
      await planner.cleanup();
      
      spinner.succeed(chalk.green(`Generated test plan: ${outputPath}`));
      console.log(chalk.cyan(`  - ${plan.scenarios.length} test scenarios`));
      console.log(chalk.cyan(`  - Explored ${plan.scenarios.filter(s => s.title.includes('Verify')).length} pages`));
    } catch (error: any) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('generate')
  .description('🎭 Generator: Transform Markdown plan into Playwright tests')
  .requiredOption('-i, --input <path>', 'Input markdown plan file (from specs/)')
  .requiredOption('-u, --url <url>', 'Base URL for tests')
  .option('-o, --output <dir>', 'Output directory for test files', './tests')
  .action(async (options) => {
    const spinner = ora('Parsing markdown plan...').start();
    
    try {
      const generator = new Generator();
      await generator.initialize();
      
      spinner.text = 'Generating Playwright tests...';
      const generatedFiles = await generator.generateTests(
        options.input,
        options.url,
        options.output
      );
      
      await generator.cleanup();
      
      const generatedDir = generator.getLastGeneratedDir();
      spinner.succeed(chalk.green(`Generated ${generatedFiles.length} test file(s)`));
      if (generatedDir) {
        console.log(chalk.cyan(`  📁 Output directory: ${generatedDir}`));
      }
      generatedFiles.forEach((file) => {
        console.log(chalk.cyan(`  - ${file}`));
      });
    } catch (error: any) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('heal')
  .description('🎭 Healer: Run tests and automatically repair failures')
  .option('-f, --file <path>', 'Specific test file to heal (optional, heals all if not specified)')
  .option('-i, --iterations <number>', 'Maximum healing iterations', '5')
  .action(async (options) => {
    const spinner = ora('Initializing healer...').start();
    
    try {
      const healer = new Healer();
      await healer.initialize();
      
      spinner.text = 'Running tests...';
      const result = await healer.runTests(options.file);
      
      if (result.passed) {
        spinner.succeed(chalk.green('All tests passed!'));
        await healer.cleanup();
        return;
      }
      
      spinner.warn(chalk.yellow(`Found ${result.failures.length} failure(s)`));
      console.log('\n' + chalk.cyan('Starting healing process...\n'));
      
      const healed = await healer.healAllFailures(
        options.file,
        parseInt(options.iterations)
      );
      
      await healer.cleanup();
      
      if (healed) {
        console.log('\n' + chalk.green('✓ All tests healed and passing!'));
      } else {
        console.log('\n' + chalk.yellow('⚠ Some tests could not be automatically healed'));
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('full')
  .description('Run complete pipeline: plan → generate → heal')
  .requiredOption('-u, --url <url>', 'URL to explore and test')
  .option('-s, --seed <path>', 'Path to seed test file (default: tests/seed/seed.spec.ts)')
  .option('-n, --navigations <number>', 'Maximum number of page navigations to perform', '3')
  .option('--ai', 'Use AI to make smarter interaction decisions (requires OPENAI_API_KEY or ANTHROPIC_API_KEY)')
  .option('--tts', 'Enable text-to-speech for AI personality (macOS only)', false)
  .option('--spec <path>', 'Path for markdown plan', './specs/test-plan.md')
  .option('--test-dir <dir>', 'Directory for generated tests', './tests')
  .option('--skip-heal', 'Skip the healing step', false)
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n🚀 Starting Cohort QA pipeline\n'));
    
    try {
      // Step 1: Plan
      console.log(chalk.bold('\n📋 Step 1: 🎭 Planner'));
      const planSpinner = ora('Exploring application...').start();
      const planner = new Planner();
      await planner.initialize(options.ai, options.tts);
      const maxNavigations = parseInt(options.navigations) || 3;
      planSpinner.text = `Exploring ${options.url} (will navigate up to ${maxNavigations} pages)...`;
      const seedPath = options.seed || 'tests/seed/seed.spec.ts';
      const plan = await planner.explore(options.url, seedPath, maxNavigations, options.ai, options.tts);
      await planner.saveMarkdown(plan, options.spec);
      await planner.cleanup();
      planSpinner.succeed(chalk.green(`Generated ${plan.scenarios.length} test scenarios`));
      
      // Step 2: Generate
      console.log(chalk.bold('\n⚙️  Step 2: 🎭 Generator'));
      const genSpinner = ora('Generating Playwright tests...').start();
      const generator = new Generator();
      await generator.initialize();
      const generatedFiles = await generator.generateTests(
        options.spec,
        options.url,
        options.testDir
      );
      await generator.cleanup();
      const generatedDir = generator.getLastGeneratedDir();
      genSpinner.succeed(chalk.green(`Generated ${generatedFiles.length} test file(s)`));
      if (generatedDir) {
        console.log(chalk.cyan(`  📁 Output directory: ${generatedDir}`));
      }
      
      // Step 3: Heal (optional)
      if (!options.skipHeal) {
        console.log(chalk.bold('\n🔧 Step 3: 🎭 Healer'));
        const healSpinner = ora('Running and fixing tests...').start();
        const healer = new Healer();
        await healer.initialize();
        
        const result = await healer.runTests();
        if (!result.passed) {
          healSpinner.warn(chalk.yellow(`Found ${result.failures.length} failure(s), attempting to heal...`));
          const healed = await healer.healAllFailures(undefined, 5);
          await healer.cleanup();
          
          if (healed) {
            healSpinner.succeed(chalk.green('All tests healed and passing!'));
          } else {
            healSpinner.warn(chalk.yellow('Some tests could not be automatically healed'));
          }
        } else {
          healSpinner.succeed(chalk.green('All tests passed!'));
          await healer.cleanup();
        }
      }
      
      console.log(chalk.bold.green('\n✅ Pipeline completed successfully!\n'));
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('interactive')
  .alias('i')
  .description('🎯 Interactive mode: Prompts for all options')
  .action(async () => {
    console.log(chalk.bold.cyan('\n🎯 Cohort QA - Interactive Mode\n'));
    
    try {
      // Ask what action to perform
      const { action } = await prompts({
        type: 'select',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { title: '📋 Plan - Explore app and generate test plan', value: 'plan' },
          { title: '⚙️  Generate - Convert plan to Playwright tests', value: 'generate' },
          { title: '🔧 Heal - Run and fix tests', value: 'heal' },
          { title: '🚀 Full Pipeline - Plan → Generate → Heal', value: 'full' }
        ],
        initial: 0
      });

      if (!action) {
        console.log(chalk.yellow('\nCancelled.'));
        process.exit(0);
      }

      if (action === 'plan') {
        const answers = await prompts([
          {
            type: 'text',
            name: 'url',
            message: 'Enter the URL to explore:',
            validate: (value: string) => {
              try {
                new URL(value);
                return true;
              } catch {
                return 'Please enter a valid URL (e.g., https://example.com)';
              }
            }
          },
          {
            type: 'number',
            name: 'navigations',
            message: 'How many pages should we navigate to?',
            initial: 3,
            min: 0,
            max: 10
          },
          {
            type: 'text',
            name: 'output',
            message: 'Output path for markdown plan:',
            initial: './specs/test-plan.md'
          },
          {
            type: 'text',
            name: 'seed',
            message: 'Path to seed test file (optional, press Enter to skip):',
            initial: ''
          },
          {
            type: 'confirm',
            name: 'useAI',
            message: 'Enable AI-powered decision making for planner?',
            initial: false
          },
          {
            type: 'confirm',
            name: 'useTTS',
            message: 'Enable text-to-speech for AI personality? (macOS only)',
            initial: false
          }
        ]);

        if (!answers.url) {
          console.log(chalk.yellow('\nCancelled.'));
          process.exit(0);
        }

        // Execute plan command
        const spinner = ora('Initializing planner...').start();
        try {
        const planner = new Planner();
        await planner.initialize(answers.useAI, answers.useTTS);
        
        const maxNavigations = answers.navigations || 3;
          spinner.text = `Exploring ${answers.url} (will navigate up to ${maxNavigations} pages)...`;
          
          const seedPath = answers.seed && answers.seed.trim() ? answers.seed : 'tests/seed/seed.spec.ts';
          const plan = await planner.explore(answers.url, seedPath, maxNavigations, answers.useAI, answers.useTTS);
          
          spinner.text = 'Generating markdown test plan...';
          const outputPath = await planner.saveMarkdown(plan, answers.output);
          
          await planner.cleanup();
          
          spinner.succeed(chalk.green(`Generated test plan: ${outputPath}`));
          console.log(chalk.cyan(`  - ${plan.scenarios.length} test scenarios`));
          console.log(chalk.cyan(`  - Explored ${plan.scenarios.filter(s => s.title.includes('Verify')).length} pages`));
        } catch (error: any) {
          spinner.fail(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        }
      }

      else if (action === 'generate') {
        const answers = await prompts([
          {
            type: 'text',
            name: 'input',
            message: 'Path to markdown plan file (from specs/):',
            initial: './specs/test-plan.md',
            validate: async (value: string) => {
              try {
                await fs.access(value);
                return true;
              } catch {
                return 'File not found. Please enter a valid path.';
              }
            }
          },
          {
            type: 'text',
            name: 'url',
            message: 'Base URL for tests:',
            validate: (value: string) => {
              try {
                new URL(value);
                return true;
              } catch {
                return 'Please enter a valid URL (e.g., https://example.com)';
              }
            }
          },
          {
            type: 'text',
            name: 'output',
            message: 'Output directory for test files:',
            initial: './tests'
          }
        ]);

        if (!answers.input || !answers.url) {
          console.log(chalk.yellow('\nCancelled.'));
          process.exit(0);
        }

        // Execute generate command
        const spinner = ora('Parsing markdown plan...').start();
        try {
          const generator = new Generator();
          await generator.initialize();
          
          spinner.text = 'Generating Playwright tests...';
          const generatedFiles = await generator.generateTests(
            answers.input,
            answers.url,
            answers.output
          );
          
          await generator.cleanup();
          
          spinner.succeed(chalk.green(`Generated ${generatedFiles.length} test file(s)`));
          generatedFiles.forEach((file) => {
            console.log(chalk.cyan(`  - ${file}`));
          });
        } catch (error: any) {
          spinner.fail(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        }
      }

      else if (action === 'heal') {
        // Get list of folders in tests directory (excluding seed)
        const testsDir = path.resolve(process.cwd(), 'tests');
        let testFolders: string[] = [];
        
        try {
          const entries = await fs.readdir(testsDir, { withFileTypes: true });
          testFolders = entries
            .filter(entry => entry.isDirectory() && entry.name !== 'seed')
            .map(entry => entry.name)
            .sort();
        } catch (error) {
          // If tests directory doesn't exist, that's okay
        }

        // Build choices for folder selection
        const folderChoices = [
          { title: '🔧 Heal all tests', value: 'all' },
          ...testFolders.map(folder => ({
            title: `📁 ${folder}`,
            value: path.join('tests', folder)
          }))
        ];

        const answers = await prompts([
          {
            type: testFolders.length > 0 ? 'select' : 'text',
            name: 'file',
            message: testFolders.length > 0 
              ? 'Select test folder to heal:' 
              : 'Specific test file to heal (optional, press Enter to heal all):',
            choices: testFolders.length > 0 ? folderChoices : undefined,
            initial: 0
          },
          {
            type: 'number',
            name: 'iterations',
            message: 'Maximum healing iterations:',
            initial: 5,
            min: 1,
            max: 20
          }
        ]);

        if (!answers.file) {
          console.log(chalk.yellow('\nCancelled.'));
          process.exit(0);
        }

        // Execute heal command
        const spinner = ora('Initializing healer...').start();
        try {
          const healer = new Healer();
          await healer.initialize();
          
          spinner.text = 'Running tests...';
          // If "all" is selected, pass undefined; otherwise pass the folder path
          const testPath = answers.file === 'all' ? undefined : answers.file;
          const result = await healer.runTests(testPath);
          
          if (result.passed) {
            spinner.succeed(chalk.green('All tests passed!'));
            await healer.cleanup();
            return;
          }
          
          spinner.warn(chalk.yellow(`Found ${result.failures.length} failure(s)`));
          console.log('\n' + chalk.cyan('Starting healing process...\n'));
          
          const healed = await healer.healAllFailures(
            testPath,
            answers.iterations || 5
          );
          
          await healer.cleanup();
          
          if (healed) {
            console.log('\n' + chalk.green('✓ All tests healed and passing!'));
          } else {
            console.log('\n' + chalk.yellow('⚠ Some tests could not be automatically healed'));
            process.exit(1);
          }
        } catch (error: any) {
          spinner.fail(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        }
      }

      else if (action === 'full') {
        const answers = await prompts([
          {
            type: 'text',
            name: 'url',
            message: 'Enter the URL to explore and test:',
            validate: (value: string) => {
              try {
                new URL(value);
                return true;
              } catch {
                return 'Please enter a valid URL (e.g., https://example.com)';
              }
            }
          },
          {
            type: 'number',
            name: 'navigations',
            message: 'How many pages should we navigate to?',
            initial: 3,
            min: 0,
            max: 10
          },
          {
            type: 'confirm',
            name: 'useAI',
            message: 'Use AI for smarter interaction decisions? (requires API key)',
            initial: false
          },
          {
            type: 'confirm',
            name: 'useTTS',
            message: 'Enable text-to-speech for AI personality? (macOS only)',
            initial: false
          },
          {
            type: 'text',
            name: 'seed',
            message: 'Path to seed test file (optional, press Enter to skip):',
            initial: ''
          },
          {
            type: 'text',
            name: 'spec',
            message: 'Path for markdown plan:',
            initial: './specs/test-plan.md'
          },
          {
            type: 'text',
            name: 'testDir',
            message: 'Directory for generated tests:',
            initial: './tests'
          },
          {
            type: 'confirm',
            name: 'skipHeal',
            message: 'Skip the healing step?',
            initial: false
          }
        ]);

        if (!answers.url) {
          console.log(chalk.yellow('\nCancelled.'));
          process.exit(0);
        }

        // Execute full pipeline
        console.log(chalk.bold.cyan('\n🚀 Starting Cohort QA pipeline\n'));
        
        try {
          // Step 1: Plan
          console.log(chalk.bold('\n📋 Step 1: 🎭 Planner'));
          const planSpinner = ora('Exploring application...').start();
          const planner = new Planner();
          await planner.initialize(answers.useAI, answers.useTTS);
          const maxNavigations = answers.navigations || 3;
          planSpinner.text = `Exploring ${answers.url} (will navigate up to ${maxNavigations} pages)...`;
          const seedPath = answers.seed && answers.seed.trim() ? answers.seed : 'tests/seed/seed.spec.ts';
          const plan = await planner.explore(answers.url, seedPath, maxNavigations, answers.useAI, answers.useTTS);
          await planner.saveMarkdown(plan, answers.spec);
          await planner.cleanup();
          planSpinner.succeed(chalk.green(`Generated ${plan.scenarios.length} test scenarios`));
          
          // Step 2: Generate
          console.log(chalk.bold('\n⚙️  Step 2: 🎭 Generator'));
          const genSpinner = ora('Generating Playwright tests...').start();
          const generator = new Generator();
          await generator.initialize();
          const generatedFiles = await generator.generateTests(
            answers.spec,
            answers.url,
            answers.testDir
          );
          await generator.cleanup();
          const generatedDir = generator.getLastGeneratedDir();
          genSpinner.succeed(chalk.green(`Generated ${generatedFiles.length} test file(s)`));
          if (generatedDir) {
            console.log(chalk.cyan(`  📁 Output directory: ${generatedDir}`));
          }
          
          // Step 3: Heal (optional)
          if (!answers.skipHeal) {
            console.log(chalk.bold('\n🔧 Step 3: 🎭 Healer'));
            const healSpinner = ora('Running and fixing tests...').start();
            const healer = new Healer();
            await healer.initialize();
            
            const result = await healer.runTests();
            if (!result.passed) {
              healSpinner.warn(chalk.yellow(`Found ${result.failures.length} failure(s), attempting to heal...`));
              const healed = await healer.healAllFailures(undefined, 5);
              await healer.cleanup();
              
              if (healed) {
                healSpinner.succeed(chalk.green('All tests healed and passing!'));
              } else {
                healSpinner.warn(chalk.yellow('Some tests could not be automatically healed'));
              }
            } else {
              healSpinner.succeed(chalk.green('All tests passed!'));
              await healer.cleanup();
            }
          }
          
          console.log(chalk.bold.green('\n✅ Pipeline completed successfully!\n'));
        } catch (error: any) {
          console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
          process.exit(1);
        }
      }

    } catch (error: any) {
      if (error.name === 'ExitPrompt') {
        console.log(chalk.yellow('\nCancelled.'));
        process.exit(0);
      }
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse();


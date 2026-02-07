/**
 * API Server for Cohort QA Frontend
 * Provides REST API endpoints to interact with Planner, Generator, and Healer
 */

import express from 'express';
import cors from 'cors';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Planner } from '../planner/Planner.js';
import { Generator } from '../generator.js';
import { Healer } from '../healer/Healer.js';
import { loadConfig } from '../config/config-loader.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper to merge settings with config
function mergeSettings(settings: any) {
  const config = loadConfig();
  return {
    ai: {
      planner: {
        provider: settings.aiProvider || config.ai.planner.provider,
        model: settings.aiModel || config.ai.planner.model,
      },
      generator: {
        provider: settings.aiProvider || config.ai.generator.provider,
        model: settings.aiModel || config.ai.generator.model,
      },
      healer: {
        provider: settings.aiProvider || config.ai.healer.provider,
        model: settings.aiModel || config.ai.healer.model,
      },
      tts: {
        provider: settings.ttsProvider || config.ai.tts.provider,
        model: settings.ttsModel || config.ai.tts.model,
        voice: settings.ttsVoice || config.ai.tts.voice,
      },
    },
  };
}

// Planner endpoints
app.post('/api/planner/run', async (req, res) => {
  try {
    const { url, maxNavigations, ignoredTags, settings } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Apply settings overrides for planner
    if (settings) {
      process.env.PLANNER_AI_PROVIDER = settings.useAI ? settings.aiProvider : 'heuristic';
      process.env.PLANNER_AI_MODEL = settings.aiModel;
      if (settings.useTTS) {
        process.env.TTS_PROVIDER = settings.ttsProvider;
        process.env.TTS_VOICE = settings.ttsVoice;
      }
    }

    console.log(`\n🚀 Starting planner for URL: ${url}`);
    console.log(`   Max navigations: ${maxNavigations || 3}`);
    console.log(`   AI enabled: ${settings?.useAI || false}`);
    console.log(`   TTS enabled: ${settings?.useTTS || false}`);
    
    const planner = new Planner();
    
    try {
      await planner.initialize(settings?.useAI || false, settings?.useTTS || false);
      console.log('✅ Planner initialized, browser launched');

      // Override ignored tags if provided - we'll need to pass this to the planner
      // For now, the planner uses PLANNER_CONFIG.IGNORED_TAGS from config.yaml
      // TODO: Add a method to Planner to set ignored tags dynamically
      if (ignoredTags && Array.isArray(ignoredTags) && ignoredTags.length > 0) {
        console.log(`   Ignored tags: ${ignoredTags.join(', ')}`);
      }

      const seedPath = 'tests/seed/seed.spec.ts';
      
      console.log('🌐 Starting exploration...');
      // Run the exploration - this is a long-running operation
      const plan = await planner.explore(
        url,
        seedPath,
        maxNavigations || 3,
        settings?.useAI || false,
        settings?.useTTS || false
      );

      console.log(`✅ Exploration complete! Generated ${plan.scenarios.length} scenarios`);
      await planner.saveMarkdown(plan, 'specs/test-plan.md');
      await planner.cleanup();

      res.json({
        success: true,
        message: `Generated ${plan.scenarios.length} test scenarios`,
        scenarios: plan.scenarios.length,
      });
    } catch (error: any) {
      console.error('❌ Planner error:', error);
      console.error('Stack:', error.stack);
      try {
        await planner.cleanup();
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      res.status(500).json({ 
        error: error.message || 'Failed to run planner',
        details: error.stack 
      });
    }
  } catch (error: any) {
    console.error('Planner error:', error);
    res.status(500).json({ error: error.message || 'Failed to run planner' });
  }
});

// Generator endpoints
app.get('/api/generator/test-plan', async (req, res) => {
  try {
    const planPath = path.join(process.cwd(), 'specs', 'test-plan.md');
    try {
      const content = await fs.readFile(planPath, 'utf-8');
      // Extract base URL from the plan if available
      const urlMatch = content.match(/https?:\/\/[^\s]+/);
      const baseUrl = urlMatch ? urlMatch[0].split('/').slice(0, 3).join('/') : '';

      res.json({
        content,
        baseUrl,
      });
    } catch {
      res.json({
        content: '',
        baseUrl: '',
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load test plan' });
  }
});

app.post('/api/generator/run', async (req, res) => {
  try {
    const { testPlan, baseUrl, settings } = req.body;

    if (!testPlan || !baseUrl) {
      return res.status(400).json({ error: 'Test plan and base URL are required' });
    }

    // Save test plan temporarily
    const planPath = path.join(process.cwd(), 'specs', 'test-plan.md');
    await fs.mkdir(path.dirname(planPath), { recursive: true });
    await fs.writeFile(planPath, testPlan, 'utf-8');

    // Apply settings overrides for generator
    if (settings) {
      process.env.GENERATOR_AI_PROVIDER = settings.useAI ? settings.aiProvider : 'heuristic';
      process.env.GENERATOR_AI_MODEL = settings.aiModel;
    }

    const generator = new Generator();
    await generator.initialize();

    const generatedFiles = await generator.generateTests(
      planPath,
      baseUrl,
      './tests'
    );

    await generator.cleanup();

    const generatedDir = generator.getLastGeneratedDir();

    res.json({
      success: true,
      message: `Generated ${generatedFiles.length} test file(s)`,
      files: generatedFiles.length,
      directory: generatedDir,
    });
  } catch (error: any) {
    console.error('Generator error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate tests' });
  }
});

// Healer endpoints
app.get('/api/healer/test-suites', async (req, res) => {
  try {
    const testsDir = path.join(process.cwd(), 'tests');
    const entries = await fs.readdir(testsDir, { withFileTypes: true });

    const suites = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name !== 'seed')
        .map(async (entry) => {
          const suitePath = path.join(testsDir, entry.name);
          const files = await fs.readdir(suitePath);
          const testFiles = files.filter((f) => f.endsWith('.spec.ts'));

          return {
            name: entry.name,
            path: suitePath,
            testCount: testFiles.length,
          };
        })
    );

    // Sort by name (most recent first if timestamped)
    suites.sort((a, b) => b.name.localeCompare(a.name));

    res.json({ suites });
  } catch (error: any) {
    console.error('Healer error:', error);
    res.status(500).json({ error: error.message || 'Failed to load test suites' });
  }
});

app.post('/api/healer/run', async (req, res) => {
  try {
    const { testSuite, settings } = req.body;

    if (!testSuite) {
      return res.status(400).json({ error: 'Test suite is required' });
    }

    // Apply settings overrides for healer
    if (settings) {
      process.env.HEALER_AI_PROVIDER = settings.useAI ? settings.aiProvider : 'heuristic';
      process.env.HEALER_AI_MODEL = settings.aiModel;
    }

    const healer = new Healer();
    await healer.initialize();

    // Store original file contents for diff generation
    const originalFiles = new Map<string, string>();
    const healedFiles: string[] = [];

    // Read original files before healing
    try {
      const files = await fs.readdir(testSuite, { recursive: true });
      for (const file of files) {
        if (typeof file === 'string' && file.endsWith('.spec.ts')) {
          const filePath = path.join(testSuite, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            originalFiles.set(filePath, content);
          } catch {
            // Skip files we can't read
          }
        }
      }
    } catch {
      // If we can't read directory, continue anyway
    }

    const healed = await healer.healAllFailures(testSuite, 5);
    
    // Compare files after healing to find what changed
    for (const [filePath, originalContent] of originalFiles.entries()) {
      try {
        const newContent = await fs.readFile(filePath, 'utf-8');
        if (originalContent !== newContent) {
          healedFiles.push(filePath);
        }
      } catch {
        // Skip files we can't read
      }
    }

    await healer.cleanup();

    res.json({
      success: healed,
      message: healed
        ? 'All tests healed and passing!'
        : 'Some tests could not be automatically healed',
      healedFiles,
    });
  } catch (error: any) {
    console.error('Healer error:', error);
    res.status(500).json({ error: error.message || 'Failed to heal tests' });
  }
});

// File browser endpoints
app.get('/api/healer/files', async (req, res) => {
  try {
    const dirPath = req.query.path as string;
    if (!dirPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      type: entry.isDirectory() ? 'directory' as const : 'file' as const,
    }));

    res.json({ files });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list files' });
  }
});

app.get('/api/healer/file-content', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to read file' });
  }
});

app.get('/api/healer/diff', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    // For now, we'll need to store original content somewhere
    // This is a simplified version - in production, you'd want to store
    // original content in a temp location or use git diff
    const currentContent = await fs.readFile(filePath, 'utf-8');
    
    // Try to read from a backup location if it exists
    const backupPath = filePath + '.backup';
    let originalContent = '';
    try {
      originalContent = await fs.readFile(backupPath, 'utf-8');
    } catch {
      // No backup found, return current content as both
      originalContent = currentContent;
    }

    res.json({
      original: originalContent,
      modified: currentContent,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get diff' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server when run directly
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMainModule || process.argv[1]?.includes('server.ts') || process.argv[1]?.includes('server.js')) {
  app.listen(PORT, () => {
    console.log(`🚀 Cohort QA API Server running on http://localhost:${PORT}`);
  });
}

export default app;


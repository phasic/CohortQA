/**
 * API Server for Cohort QA Frontend
 * Provides REST API endpoints to interact with Planner, Generator, and Healer
 */

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
  console.log('✅ Loaded environment variables from .env file');
} catch (error) {
  // .env file doesn't exist or can't be read, that's okay
  // User can set environment variables manually or create .env file
  console.log('ℹ️  No .env file found (or couldn\'t read it). Using system environment variables.');
}

import express from 'express';
import cors from 'cors';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Planner } from '../planner/Planner.js';
import { Generator } from '../generator.js';
import { Healer } from '../healer/Healer.js';
import { loadConfig } from '../config/config-loader.js';
import { logStreamer } from './log-streamer.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Store active operations and their abort controllers
interface ActiveOperation {
  abortController: AbortController;
  planner?: Planner;
  generator?: Generator;
  healer?: Healer;
  streamId?: string;
}

const activeOperations = new Map<string, ActiveOperation>();

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

// Log streaming endpoint (Server-Sent Events)
app.get('/api/logs/stream', (req, res) => {
  const streamId = req.query.streamId as string;
  const operation = (req.query.operation as string) || 'operation';

  if (!streamId) {
    return res.status(400).json({ error: 'streamId is required' });
  }

  logStreamer.startStream(streamId, res, operation);
});

// Stop operation endpoint
app.post('/api/planner/stop', async (req, res) => {
  const { streamId } = req.body;
  
  if (!streamId) {
    return res.status(400).json({ error: 'streamId is required' });
  }
  
  const operation = activeOperations.get(streamId);
  if (operation) {
    console.log(`⏹️  Stopping planner operation: ${streamId}`);
    operation.abortController.abort();
    
    // Cleanup
    if (operation.planner) {
      try {
        await operation.planner.cleanup();
      } catch (err) {
        console.error('Error during planner cleanup:', err);
      }
    }
    
    activeOperations.delete(streamId);
    res.json({ success: true, message: 'Planner stopped' });
  } else {
    res.status(404).json({ error: 'Operation not found' });
  }
});

// Planner endpoints
app.post('/api/planner/run', async (req, res) => {
  const streamId = req.body.streamId as string | undefined;
  let logInterceptorEnabled = false;
  let planner: Planner | null = null;

  // Create abort controller for this request
  const abortController = new AbortController();
  
  // Store the operation so it can be stopped via the stop endpoint
  if (streamId) {
    activeOperations.set(streamId, {
      abortController,
      planner: undefined, // Will be set when planner is created
      streamId,
    });
  }
  
  // Track if we've already handled the abort
  let hasAborted = false;
  let checkRequestState: NodeJS.Timeout | null = null;
  
  // Handle explicit request abort (when frontend calls AbortController.abort())
  // This is the PRIMARY way to detect user-initiated cancellation
  req.on('aborted', () => {
    if (!hasAborted && !res.headersSent) {
      console.log('⏹️  Request aborted by client (user stopped)');
      hasAborted = true;
      if (checkRequestState) {
        clearInterval(checkRequestState);
        checkRequestState = null;
      }
      abortController.abort();
      if (planner) {
        planner.cleanup().catch(err => console.error('Error during cleanup on abort:', err));
      }
      if (streamId) {
        activeOperations.delete(streamId);
      }
    }
  });
  
  // Monitor request state periodically as a fallback
  // This catches cases where the request is closed but 'aborted' event doesn't fire
  checkRequestState = setInterval(() => {
    // Only abort if:
    // 1. We haven't already aborted
    // 2. The response hasn't been sent
    // 3. The request is actually destroyed/aborted (not just a temporary state)
    // 4. The socket is actually closed
    if (!hasAborted && !res.headersSent) {
      const isDestroyed = req.destroyed || req.aborted;
      const isSocketClosed = req.socket?.destroyed || req.socket?.readyState === 'closed';
      
      // Only abort if BOTH the request AND socket are closed
      // This indicates a real disconnect, not just a temporary network issue
      if (isDestroyed && isSocketClosed) {
        console.log('⏹️  Client disconnected, cancelling planner...');
        hasAborted = true;
        if (checkRequestState) {
          clearInterval(checkRequestState);
          checkRequestState = null;
        }
        abortController.abort();
        if (planner) {
          planner.cleanup().catch(err => console.error('Error during cleanup on disconnect:', err));
        }
      }
    } else if (res.headersSent || hasAborted) {
      // Request completed or already aborted, stop checking
      if (checkRequestState) {
        clearInterval(checkRequestState);
        checkRequestState = null;
      }
    }
  }, 1000); // Check every 1 second for faster response

  try {
      const { url, maxNavigations, ignoredTags, settings, streamId: _streamId, personality } = req.body;

    console.log(`🎭 API received personality from frontend: "${personality}" (type: ${typeof personality})`);
    console.log(`🎭 Full request body keys:`, Object.keys(req.body));

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Enable log interception if streamId is provided
    if (streamId) {
      logStreamer.enableInterception(streamId);
      logInterceptorEnabled = true;
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
    console.log(`   Headless mode: ${settings?.headless || false}`);
    if (personality) {
      console.log(`   🎭 Personality: ${personality}`);
    }
    
    planner = new Planner();
    
    // Update the stored operation with the planner instance
    if (streamId) {
      const operation = activeOperations.get(streamId);
      if (operation) {
        operation.planner = planner;
      }
    }
    
    try {
      await planner.initialize(settings?.useAI || false, settings?.useTTS || false, settings?.headless || false);
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
      // Pass abort signal so planner can be cancelled
      const finalPersonality = personality || 'playful';
      console.log(`🎭 API: Passing personality "${finalPersonality}" to planner.explore()`);
      const plan = await planner.explore(
        url,
        seedPath,
        maxNavigations || 3,
        settings?.useAI || false,
        settings?.useTTS || false,
        settings?.headless || false,
        abortController.signal,
        finalPersonality
      );

      console.log(`✅ Exploration complete! Generated ${plan.scenarios.length} scenarios`);
      await planner.saveMarkdown(plan, 'specs/test-plan.md');
      await planner.cleanup();

      // Check if request was cancelled
      if (abortController.signal.aborted) {
        console.log('⏹️  Request was cancelled');
        return; // Don't send response, client already disconnected
      }

      res.json({
        success: true,
        message: `Generated ${plan.scenarios.length} test scenarios`,
        scenarios: plan.scenarios.length,
      });
    } catch (error: any) {
      // If cancelled, don't send error response
      if (error.message === 'Exploration cancelled' || abortController.signal.aborted) {
        console.log('⏹️  Planner cancelled');
        return; // Client already disconnected or cancelled
      }

      console.error('❌ Planner error:', error);
      console.error('Stack:', error.stack);
      try {
        if (planner) {
          await planner.cleanup();
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      
      // Only send error if request is still active
      if (!res.headersSent && !abortController.signal.aborted) {
        res.status(500).json({ 
          error: error.message || 'Failed to run planner',
          details: error.stack 
        });
      }
    }
  } catch (error: any) {
    // If cancelled, don't send error response
    if (error.message === 'Exploration cancelled' || abortController.signal.aborted) {
      console.log('⏹️  Planner cancelled');
      return; // Client already disconnected or cancelled
    }

    console.error('Planner error:', error);
    
    // Only send error if request is still active
    if (!res.headersSent && !abortController.signal.aborted) {
      res.status(500).json({ error: error.message || 'Failed to run planner' });
    }
  } finally {
      // Clear the request state check interval
      if (checkRequestState) {
        clearInterval(checkRequestState);
        checkRequestState = null;
      }
      
      // Cleanup planner if it exists
      if (planner) {
        try {
          await planner.cleanup();
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }
      }
      
      // Remove from active operations
      if (streamId) {
        activeOperations.delete(streamId);
      }

      // Disable log interception
      if (logInterceptorEnabled) {
        logStreamer.disableInterception();
        if (streamId) {
          logStreamer.stopStream(streamId);
        }
      }
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
  const streamId = req.body.streamId as string | undefined;
  let logInterceptorEnabled = false;

  try {
    const { testPlan, baseUrl, settings, streamId: _streamId } = req.body;

    if (!testPlan || !baseUrl) {
      return res.status(400).json({ error: 'Test plan and base URL are required' });
    }

    // Enable log interception if streamId is provided
    if (streamId) {
      logStreamer.enableInterception(streamId);
      logInterceptorEnabled = true;
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
  } finally {
    // Disable log interception
    if (logInterceptorEnabled) {
      logStreamer.disableInterception();
      if (streamId) {
        logStreamer.stopStream(streamId);
      }
    }
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
  const streamId = req.body.streamId as string | undefined;
  let logInterceptorEnabled = false;

  try {
    const { testSuite, settings, streamId: _streamId } = req.body;

    if (!testSuite) {
      return res.status(400).json({ error: 'Test suite is required' });
    }

    // Enable log interception if streamId is provided
    if (streamId) {
      logStreamer.enableInterception(streamId);
      logInterceptorEnabled = true;
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
  } finally {
    // Disable log interception
    if (logInterceptorEnabled) {
      logStreamer.disableInterception();
      if (streamId) {
        logStreamer.stopStream(streamId);
      }
    }
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


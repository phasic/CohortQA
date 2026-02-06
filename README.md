# Cohort QA

A command-line interface for [Playwright Test Agents](https://playwright.dev/docs/test-agents) - the official planner, generator, and healer agents from Playwright.

## Overview

This CLI provides easy access to Playwright's three core agents:

1. **🎭 Planner**: Explores web applications and generates Markdown test plans
2. **🎭 Generator**: Transforms Markdown plans into executable Playwright Test files
3. **🎭 Healer**: Executes test suites and automatically repairs failing tests

## Features

- **🤖 AI-Powered Exploration**: Optional AI integration to make smarter decisions about which elements to interact with
- **Shadow DOM Support**: Automatically traverses shadow roots (including nested) to find interactive elements
- **Domain Protection**: Never navigates away from the target domain
- **Intelligent Clicking**: Clicks around apps automatically, handling cookie popups and modals

## Installation

### Verify AI Setup

Before using AI features, check your setup:

```bash
./check-ai.sh
```

This will verify:
- ✅ Ollama installation
- ✅ Ollama server status
- ✅ Mistral model availability
- ✅ Environment variables

### Quick Setup (Recommended)

Run the setup script to install everything:

```bash
./setup.sh
```

This will:
- ✅ Check Node.js version (requires 18+)
- ✅ Install all npm dependencies
- ✅ Build the TypeScript project
- ✅ Install Playwright browsers
- ✅ Check for Ollama and install Mistral model (optional, for AI features)

### Manual Setup

If you prefer to set up manually:

```bash
npm install
npm run build
npx playwright install chromium

# Optional: For AI features
# Install Ollama: https://ollama.ai
ollama pull mistral
```

## Quick Start

### Interactive Mode (Recommended for First-Time Users)

The easiest way to use the CLI is through interactive mode, which prompts you for all options:

```bash
npm start -- interactive
# or use the alias
npm start -- i
```

### 1. Initialize Playwright Test Agents (Optional)

If you want to use Playwright's official agent definitions with AI assistants:

```bash
npm start -- init
# or with specific loop type
npm start -- init --loop vscode
```

### 2. Run the Full Pipeline

```bash
# Using npm (note the -- to pass arguments)
npm start -- full -u https://example.com

# With AI-powered exploration
npm start -- full -u https://example.com --ai

# Or use npm run
npm run start full -u https://example.com

# Or run directly after building
npm run build
node dist/cli.js full -u https://example.com
```

This will:
- Explore the URL and generate a test plan in `specs/test-plan.md`
- Generate Playwright tests in `tests/`
- Run and heal any failing tests

## Commands

### `interactive` / `i` - Interactive Mode

Run the CLI in interactive mode with prompts for all options. This is the easiest way to use the tool, especially for first-time users.

```bash
npm start -- interactive
# or
npm start -- i
```

The interactive mode will:
- Ask what action you want to perform (plan, generate, heal, or full pipeline)
- Prompt for all required and optional parameters
- Validate inputs (URLs, file paths, etc.)
- Execute the selected command with your choices

### `plan` - 🎭 Planner

Explore a web application and generate a Markdown test plan.

```bash
npm start -- plan -u https://example.com [options]
```

Options:
- `-u, --url <url>`: URL to explore (required)
- `-o, --output <path>`: Output path for markdown plan (default: `./specs/test-plan.md`)
- `-s, --seed <path>`: Path to seed test file (e.g., `tests/seed.spec.ts`)
- `-n, --navigations <number>`: Maximum number of page navigations to perform (default: `3`)
- `--ai`: Use AI to make smarter interaction decisions (requires API key)
- `--tts`: Enable text-to-speech for AI personality (speaks thoughts and actions)

**Output**: Markdown test plan saved to `specs/` directory

### `generate` - 🎭 Generator

Transform a Markdown test plan into executable Playwright tests.

```bash
npm start -- generate -i specs/test-plan.md -u https://example.com [options]
```

Options:
- `-i, --input <path>`: Input markdown plan file from `specs/` (required)
- `-u, --url <url>`: Base URL for tests (required)
- `-o, --output <dir>`: Output directory for test files (default: `./tests`)

**Output**: Playwright test files in `tests/` directory

### `heal` - 🎭 Healer

Run tests and automatically repair failures.

```bash
npm start -- heal [options]
```

Options:
- `-f, --file <path>`: Specific test file to heal (optional, heals all if not specified)
- `-i, --iterations <number>`: Maximum healing iterations (default: `5`)

**Output**: Fixed test files (tests are modified in place)

### `full` - Complete Pipeline

Run the complete pipeline: plan → generate → heal.

```bash
npm start -- full -u https://example.com [options]
```

Options:
- `-u, --url <url>`: URL to explore and test (required)
- `-s, --seed <path>`: Path to seed test file
- `-n, --navigations <number>`: Maximum number of page navigations to perform (default: `3`)
- `--ai`: Use AI to make smarter interaction decisions (requires API key)
- `--tts`: Enable text-to-speech for AI personality (speaks thoughts and actions)
- `--spec <path>`: Path for markdown plan (default: `./specs/test-plan.md`)
- `--test-dir <dir>`: Directory for generated tests (default: `./tests`)
- `--skip-heal`: Skip the healing step

## AI-Powered Exploration

The planner can use AI to make smarter decisions about which elements to interact with, prioritizing actions that are most valuable for test coverage.

### Setup

**Ollama (Recommended - Free, Local)**:
1. Install Ollama: https://ollama.ai
2. Pull Mistral model:
   ```bash
   ollama pull mistral
   ```
3. Make sure Ollama is running (it starts automatically, or run `ollama serve`)

That's it! The planner defaults to Ollama if no API keys are set.

**Alternative: Cloud AI Providers**

1. **OpenAI**:
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   export AI_PROVIDER="openai"
   ```

2. **Anthropic Claude**:
   ```bash
   export ANTHROPIC_API_KEY="your-api-key-here"
   export AI_PROVIDER="anthropic"
   ```

### Usage

```bash
# With Ollama (default, free)
npm start -- plan -u https://example.com --ai

# Or in interactive mode, you'll be prompted to enable AI
npm start -- interactive
```

**Note**: The planner defaults to Ollama if no API keys are found, so `--ai` will use Ollama automatically!

### How It Works

When AI is enabled, the planner:
1. Scans the page for all interactive elements
2. Sends page context (URL, title, headings, available elements) to the AI
3. AI analyzes and recommends the best element to interact with
4. Planner follows the AI's recommendation

The AI considers:
- **Navigation potential**: Links that lead to new pages
- **Action importance**: Primary buttons (Submit, Login, Search, etc.)
- **Test value**: Elements that reveal new functionality
- **Efficiency**: Avoiding redundant interactions

### Fallback Behavior

If AI is unavailable or fails:
- Falls back to **heuristic-based selection** (prioritizes links, then action buttons)
- If heuristics fail, falls back to **random selection**

## Project Structure

Following Playwright's conventions:

```
repo/
  specs/                      # Markdown test plans
    test-plan.md
  tests/                      # Generated Playwright tests
    seed.spec.ts              # Optional seed test
    *.spec.ts                 # Generated test files
  playwright.config.ts        # Playwright configuration
```

## Example Workflow

```bash
# 1. Explore a website and generate test plan (with AI)
npm start -- plan -u https://example.com --ai

# 2. Generate Playwright tests from the plan
npm start -- generate -i specs/test-plan.md -u https://example.com

# 3. Run and heal the tests
npm start -- heal

# Or run everything at once:
npm start -- full -u https://example.com --ai
```

## Seed Tests

Seed tests provide a ready-to-use `page` context to bootstrap execution. Create a `tests/seed.spec.ts` file:

```typescript
import { test, expect } from '@playwright/test';

test('seed', async ({ page }) => {
  // This test sets up the environment
  // Planner will use this as context for generated tests
});
```

Reference it when planning:

```bash
npm start -- plan -u https://example.com -s tests/seed.spec.ts
```

## How It Works

### Planner

- Launches a browser and navigates to the target URL
- **Handles cookie popups automatically** (randomly clicks one of the buttons)
- **Traverses shadow DOM** to find all interactive elements (including nested shadow roots)
- Interacts with the page: clicks buttons, fills input fields, clicks links
- Navigates to multiple pages (configurable with `-n` option)
- **Uses AI** (optional) to intelligently select which elements to interact with
- Analyzes page structure on each visited page (buttons, forms, inputs, links)
- Discovers interactive elements and user flows across multiple pages
- Generates structured test scenarios in Markdown format based on all explored pages
- Outputs to `specs/` directory following Playwright conventions
- **Never navigates away from the main domain** - automatically detects and recovers

### Generator

- Parses Markdown test plans from `specs/`
- Converts natural language steps into Playwright code
- Verifies selectors and assertions live
- Generates executable test files in `tests/`
- Follows Playwright's test structure and best practices

### Healer

- Runs Playwright tests and detects failures
- Replays failing steps and inspects the UI
- Automatically fixes common issues:
  - Timeout problems (increases wait times)
  - Selector issues (uses more robust selectors)
  - Navigation errors (adds proper wait conditions)
  - Assertion failures (adjusts assertions)
- Iteratively retries until tests pass or max iterations reached

## Environment Variables

You can set environment variables in two ways:

1. **Using a `.env` file** (recommended for local development):
   - Copy `.env.example` to `.env`: `cp .env.example .env`
   - Edit `.env` and add your API keys
   - The `.env` file is already in `.gitignore` and won't be committed

2. **Using system environment variables** (for production or CI/CD)

### AI Provider Options

**OpenAI** (default):
- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_MODEL`: Model to use (default: `gpt-4o-mini`)

**Anthropic Claude**:
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `AI_PROVIDER`: Set to `"anthropic"`
- `ANTHROPIC_MODEL`: Model to use (default: `claude-3-haiku-20240307`)

**Local Ollama** (default, free, no API costs):
- `AI_PROVIDER`: Set to `"ollama"` (default if no API keys found)
- `OLLAMA_URL`: Ollama server URL (default: `http://localhost:11434/api/chat`)
- `OLLAMA_MODEL`: Model to use (default: `mistral`)

To use Ollama (local, free):
1. Install Ollama: https://ollama.ai
2. Pull Mistral model: `ollama pull mistral`
3. Run: `npm start -- plan -u https://example.com --ai` (Ollama is the default!)

## Text-to-Speech (TTS)

The planner can speak its thoughts and actions using text-to-speech, making it feel like the AI is thinking out loud!

### TTS Providers (Automatic Selection)

The system automatically selects the best available TTS provider:

1. **OpenAI TTS** (if `OPENAI_API_KEY` is set) - Most natural voices
2. **Piper TTS** (if installed) - Free, offline, natural voices
3. **macOS `say`** (fallback) - Basic robotic voice

### Setup Piper TTS (Free, Offline, Natural Voice)

For the best free and offline experience, install Piper TTS:

```bash
./install-piper.sh
```

This will:
- Install Piper TTS via Homebrew
- Download a natural-sounding English voice model
- Set up everything automatically

**Manual Installation**:
```bash
# Install Piper TTS
brew install piper-tts

# Download a voice model (example: en_US-amy-medium)
mkdir -p ~/.local/share/piper/voices/en/en_US/amy/medium
cd ~/.local/share/piper/voices/en/en_US/amy/medium
curl -L -o en_US-amy-medium.onnx \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx"
curl -L -o en_US-amy-medium.onnx.json \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx.json"
```

### Usage

```bash
# With TTS enabled
npm start -- plan -u https://example.com --ai --tts

# The AI will speak:
# - "AI assistant activated. Ready to explore!"
# - "Found 35 interactive elements on example.com"
# - "Let me analyze these elements and pick the best one..."
# - "I'll click on 'Investing'. This link leads to investment products..."
# - "Alright, clicking on the link now..."
```

### Voice Quality

- **OpenAI TTS**: Most natural, requires API key, costs ~$0.015 per 1,000 characters
- **Piper TTS**: Very natural, free, offline, requires installation
- **macOS `say`**: Basic/robotic, free, built-in, no setup needed

## References

- [Playwright Test Agents Documentation](https://playwright.dev/docs/test-agents)
- [Playwright Documentation](https://playwright.dev)

## License

MIT

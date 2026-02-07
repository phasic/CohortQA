# Cohort QA

A command-line interface for [Playwright Test Agents](https://playwright.dev/docs/test-agents) - the official planner, generator, and healer agents from Playwright.

## Overview

Cohort QA provides easy access to Playwright's three core agents via both CLI and a standalone PWA frontend:

1. **🎭 Planner**: Explores web applications and generates Markdown test plans
2. **🎭 Generator**: Transforms Markdown plans into executable Playwright Test files
3. **🎭 Healer**: Executes test suites and automatically repairs failing tests

### Frontend PWA

A standalone Progressive Web App (PWA) is available in the `frontend/` directory, providing a graphical interface for all three components with settings override capabilities.

See [Frontend Setup](#frontend-setup) for details.

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

## AI Integration

Cohort QA uses AI across all three components (Planner, Generator, and Healer) to make intelligent decisions and generate high-quality test code.

### AI-Powered Components

1. **🎭 Planner**: Uses AI to select the best elements to interact with during exploration
2. **🎭 Generator**: Uses AI to generate maintainable, best-practice Playwright test code
3. **🎭 Healer**: Uses AI to intelligently fix broken tests with optimal selector strategies

All AI components support graceful fallback to heuristics when AI is unavailable or disabled.

### Configuration

AI providers and models are configured in `config.yaml`:

```yaml
ai:
  planner:
    provider: ollama  # Options: [heuristic, ollama, openai, anthropic]
    model: mistral    # Model name
  
  generator:
    provider: heuristic  # Options: [heuristic, ollama, openai, anthropic]
    model: mistral    # Model name
  
  healer:
    provider: ollama  # Options: [heuristic, ollama, openai, anthropic]
    model: mistral    # Model name
```

You can also use environment variables:
- `PLANNER_AI_PROVIDER`, `GENERATOR_AI_PROVIDER`, `HEALER_AI_PROVIDER`
- `PLANNER_AI_MODEL`, `GENERATOR_AI_MODEL`, `HEALER_AI_MODEL`

### Setup

**Ollama (Recommended - Free, Local)**:
1. Install Ollama: https://ollama.ai
2. Pull Mistral model:
   ```bash
   ollama pull mistral
   ```
3. Make sure Ollama is running (it starts automatically, or run `ollama serve`)

That's it! Components default to Ollama if no API keys are set.

**Alternative: Cloud AI Providers**

1. **OpenAI**:
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   ```

2. **Anthropic Claude**:
   ```bash
   export ANTHROPIC_API_KEY="your-api-key-here"
   ```

### How AI Works in Each Component

#### Planner - Element Selection

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

#### Generator - Test Code Generation

When AI is enabled, the generator:
1. Analyzes each test scenario from the Markdown plan
2. Sends scenario context (steps, expected results) to the AI
3. AI generates complete Playwright test code following best practices
4. Validates code completeness before saving

The AI generates:
- Proper selector strategies (getByRole, getByLabel, etc.)
- Appropriate wait conditions and timeouts
- Maintainable and readable test code
- Best-practice assertions

#### Healer - Test Fixing

When AI is enabled, the healer:
1. Analyzes test failures with full context (test code, error message, line numbers)
2. Sends failure context to the AI
3. AI suggests best selector strategies and fixes
4. Generates fixed code focusing on coverage and maintainability
5. Validates code completeness before saving

The AI focuses on:
- **Best selector strategies**: getByRole, getByLabel, getByPlaceholder, etc.
- **Test coverage**: Selectors that provide good coverage
- **Maintainability**: Code that's easy to read and maintain
- **Playwright best practices**: Following official recommendations

### Fallback Behavior

All AI components gracefully fall back to heuristics when:
- AI is unavailable (no API keys, server down, etc.)
- AI fails (timeout, error, etc.)
- `provider: heuristic` is explicitly set in config

**Planner**: Falls back to heuristic-based selection → random selection  
**Generator**: Falls back to heuristic-based code generation  
**Healer**: Falls back to heuristic fixers (SelectorFixer, NavigationFixer, etc.)

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
- Uses AI (if enabled) to generate maintainable, best-practice Playwright code
- Falls back to heuristic-based code generation if AI unavailable
- Converts natural language steps into Playwright code
- Generates executable test files in `tests/` (timestamped folders)
- Follows Playwright's test structure and best practices
- Includes proper selectors, wait conditions, and assertions

### Healer

- Runs Playwright tests and detects failures
- Uses AI (if enabled) to intelligently fix broken tests with optimal selectors
- Falls back to heuristic fixers if AI unavailable
- Automatically fixes common issues:
  - Selector issues (chooses best selectors for context and coverage)
  - Timeout problems (increases wait times)
  - Navigation errors (adds proper wait conditions)
  - Assertion failures (adjusts assertions)
- Focuses on test coverage, maintainability, and best practices
- Iteratively retries until tests pass or max iterations reached

## Environment Variables

You can set environment variables in two ways:

1. **Using a `.env` file** (recommended for local development):
   - Copy `.env.example` to `.env`: `cp .env.example .env`
   - Edit `.env` and add your API keys
   - The `.env` file is already in `.gitignore` and won't be committed

2. **Using system environment variables** (for production or CI/CD)

### AI Provider Options

Each component (Planner, Generator, Healer) can use independent AI providers:

**OpenAI**:
- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_MODEL`: Model to use (default: `gpt-4o-mini`)
- Configure in `config.yaml`: `ai.planner.provider: openai` (or `generator`, `healer`)

**Anthropic Claude**:
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `ANTHROPIC_MODEL`: Model to use (default: `claude-3-haiku-20240307`)
- Configure in `config.yaml`: `ai.planner.provider: anthropic` (or `generator`, `healer`)

**Local Ollama** (default, free, no API costs):
- `OLLAMA_URL`: Ollama server URL (default: `http://localhost:11434/api/chat`)
- `OLLAMA_MODEL`: Model to use (default: `mistral`)
- Configure in `config.yaml`: `ai.planner.provider: ollama` (or `generator`, `healer`)
- Default if no API keys found

**Heuristic (No AI)**:
- Set `provider: heuristic` in `config.yaml` to explicitly disable AI
- Uses heuristic-based algorithms instead

To use Ollama (local, free):
1. Install Ollama: https://ollama.ai
2. Pull Mistral model: `ollama pull mistral`
3. Configure in `config.yaml` or use defaults

## Personality System

Cohort QA includes a personality system that influences both AI decision-making and TTS speech patterns. You can select from 8 different personalities:

- **Playful**: Fun, lighthearted, and curious (default)
- **Sarcastic**: Witty, ironic, and slightly mocking
- **Annoyed**: Impatient, frustrated, and grumpy
- **Professional**: Formal, business-like, and efficient
- **Excited**: Enthusiastic, energetic, and upbeat
- **Curious**: Inquisitive, thoughtful, and exploratory
- **Skeptical**: Doubtful, questioning, and cautious
- **Enthusiastic**: Eager, positive, and optimistic

### How It Works

1. **Personality Flow**: Frontend → API → Planner → TTS → PrefixGenerator
2. **AI Decision-Making**: The selected personality influences how the AI selects elements and makes decisions
3. **TTS Speech Patterns**: The personality affects the prefixes and phrases used in text-to-speech (e.g., "Ugh," for annoyed, "Oh great," for sarcastic)
4. **Initialization**: TTS is recreated in `Planner.explore()` after personality is set to ensure correct initialization

### Usage

In the frontend, select a personality from the dropdown in the Settings panel. The personality affects:
- How the AI reasons about which elements to click
- The tone and style of TTS speech
- The prefixes and phrases used when speaking

## Text-to-Speech (TTS)

The planner can speak its thoughts and actions using text-to-speech, making it feel like the AI is thinking out loud! The speech patterns are influenced by the selected personality.

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

# The AI will speak (personality-dependent):
# - Playful: "Oh! Found 35 interactive elements on example.com"
# - Annoyed: "Ugh, 35 elements found. Let me pick one..."
# - Sarcastic: "Oh great, 35 elements. Let's see which one..."
# - The personality affects both the AI's decision-making and TTS speech patterns
```

### Voice Quality

- **OpenAI TTS**: Most natural, requires API key, costs ~$0.015 per 1,000 characters
- **Piper TTS**: Very natural, free, offline, requires installation
- **macOS `say`**: Basic/robotic, free, built-in, no setup needed

## Frontend Setup

The frontend is a standalone PWA that provides a graphical interface for all three components.

### Quick Start

```bash
# Install frontend dependencies
cd frontend
npm install

# Start the API server (Terminal 1)
cd ..
npm run api

# Start the frontend dev server (Terminal 2)
cd frontend
npm run dev
```

Then open http://localhost:3000 in your browser.

### Features

- **Planner Page**: Enter URL, configure navigations, ignored tags, and AI/TTS settings
  - Headless mode toggle (run browser in background)
  - Real-time log streaming from backend operations
  - System prompt editor for planner AI
  - Personality selection dropdown (8 personality options)
  - Force stop button (immediately cancels running operations)
- **Generator Page**: View and edit test plans, generate Playwright tests
  - Real-time log streaming from backend operations
  - System prompt editor for generator AI
  - Force stop button
- **Healer Page**: Browse test suites and run healing operations
  - View test file contents and diffs for healed files
  - Real-time log streaming from backend operations
  - System prompt editor for healer AI
  - Force stop button
- **Settings Override**: Override global `config.yaml` settings per operation
  - Independent AI provider/model selection for each component
  - Provider-specific dropdowns for AI models and TTS voices
  - TTS settings (planner only): provider and voice selection
- **Personality Selection**: Choose AI personality to influence behavior and TTS responses
  - Available personalities: playful, sarcastic, annoyed, professional, excited, curious, skeptical, enthusiastic
  - Personality affects AI decision-making and TTS speech patterns
  - 8 personality options: playful, sarcastic, annoyed, professional, excited, curious, skeptical, enthusiastic
  - Personality is passed through the entire system: Frontend → API → Planner → TTS → PrefixGenerator
  - TTS is recreated with correct personality after initialization to ensure proper behavior
  - Visual indicator shows selected personality
- **Real-time Log Streaming**: All backend operations stream logs to the frontend via Server-Sent Events (SSE)
  - Terminal-like log output component
  - Collapsible by default, auto-expands when logs arrive
  - Shows connection status and log count
- **Operation Management**: Active operations can be stopped immediately
  - Dedicated stop endpoints (`/api/planner/stop`, etc.)
  - Operations tracked with abort controllers
  - Proper cleanup of browser resources on stop
  - Frontend "Stop" button calls stop endpoint and aborts HTTP request
- **PWA**: Installable as a standalone app (works offline after first load)

### Building for Production

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/` and can be served with any static file server.

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) folder:

- **[Architecture](./docs/ARCHITECTURE.md)**: Complete system architecture, modules, AI components, and data flow
- **[Planner Decision Tree](./docs/planner-decision-tree.md)**: Detailed decision-making process for element selection, including flowcharts and sequence diagrams

## References

- [Playwright Test Agents Documentation](https://playwright.dev/docs/test-agents)
- [Playwright Documentation](https://playwright.dev)

## License

MIT

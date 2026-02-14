# Cohort QA

AI-powered web exploration and interaction system using QWEN 2.5 Coder 14B.

## Overview

This system automatically explores web applications by:
1. Opening a URL in a browser
2. Scanning the DOM (including shadow DOM)
3. Extracting interactable elements with configurable guardrails
4. Using AI to select which element to interact with
5. Interacting with the selected element
6. Repeating until a set number of navigations occur

## Prerequisites

- Node.js 18+
- Ollama with QWEN 2.5 Coder 14B model installed

## Installation

```bash
npm install
npm run build
```

## Setup Ollama

Make sure Ollama is running and the QWEN 2.5 Coder 14B model is installed:

```bash
# Start Ollama (if not already running)
ollama serve

# Pull the QWEN 2.5 Coder 14B model
ollama pull qwen2.5-coder:14b
```

## Configuration

Edit `config.yaml` to customize:
- Browser settings (headless mode, timeouts)
- Navigation limits
- Element extraction guardrails
- AI model settings and prompts
- Interaction delays

## Usage

### Planner (Web Exploration)

The planner explores a website and generates a test plan:

```bash
npm run planner -- -u <url>
```

Example:
```bash
npm run planner -- -u https://example.com
```

This will:
1. Explore the website automatically
2. Generate a test plan in `test-plan/test-plan.md`

### Generator (Test Suite Generation)

The generator reads the test plan and creates a Playwright test suite:

```bash
npm run generate
```

Options:
- `--test-plan=<path>`: Specify custom test plan path (default: `test-plan/test-plan.md`)
- `--output=<path>`: Specify output directory (default: `tests`)

Example:
```bash
npm run generate -- --output=./playwright-tests
```

This will generate a Playwright test file at `tests/generated.spec.ts` that you can run with:

```bash
npx playwright test tests/generated.spec.ts
```

## How It Works

### Planner Component

1. **Browser Initialization**: Launches a Chromium browser (headed or headless)
2. **DOM Scanning**: Recursively scans the DOM including shadow DOM for interactable elements
3. **Element Extraction**: Filters elements based on guardrails (size, visibility, excluded selectors)
4. **AI Selection**: Sends element list to QWEN 2.5 Coder 14B which returns which element to interact with and how
5. **Interaction**: Performs the action (click, type, select, etc.)
6. **Navigation Tracking**: Tracks URL changes and stops after max navigations
7. **Test Plan Generation**: Creates a markdown test plan with steps and expected results

### Generator Component

1. **Parse Test Plan**: Reads and parses the markdown test plan
2. **Generate Test Code**: Converts test plan steps into Playwright test code
3. **Create Assertions**: Generates assertions for expected results (URLs, page titles, notable elements)
4. **Output Test Suite**: Writes a ready-to-run Playwright test file

## Configuration Options

See `config.yaml` for all available options including:
- Whitelist selectors for element extraction
- AI model parameters
- Interaction delays
- Navigation limits

## Architecture Documentation

For detailed information about:
- Component architecture and responsibilities
- Execution flow and sequence diagrams
- Data structures and communication patterns
- Extension points

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)


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
- AI Provider (choose one):
  - **Ollama** with QWEN 2.5 Coder 14B model installed, OR
  - **LM Studio** with a compatible model running

## Installation

```bash
npm install
npm run build
```

## Setup AI Provider

### Option 1: Ollama

Make sure Ollama is running and the QWEN 2.5 Coder 14B model is installed:

```bash
# Start Ollama (if not already running)
ollama serve

# Pull the QWEN 2.5 Coder 14B model
ollama pull qwen2.5-coder:14b
```

### Option 2: LM Studio

1. Install and open LM Studio
2. Download a compatible model (e.g., QWEN 2.5 Coder 14B)
3. Start the local server (usually on `http://localhost:1234`)
4. Update `config.yaml` to set `ai.provider: "lmstudio"` and `ai.base_url: "http://localhost:1234"`

## Configuration

Edit `config.yaml` to customize:

### Core Settings
- **start_url**: The URL to start exploration from
- **stay_on_path**: Optional path restriction (e.g., `/product/7230/open`)

### Browser Settings
- Headless mode, timeouts
- **Cookies**: Configure cookies to set before page load (e.g., to bypass cookie popups)

### Navigation Settings
- **max_navigations**: Maximum number of URL changes
- **max_loops**: Maximum number of loop iterations
- **stay_on_domain**: Restrict navigation to starting domain

### Element Extraction
- **interactable_elements**: Selectors for elements to extract (whitelist)
- **blacklist_tags**: HTML tags to ignore (and all their children)
- **notable_elements**: Selectors for elements to identify as notable in test plans
- **enable_notable_elements**: Enable/disable notable element identification
- **max_elements**: Maximum elements to extract

### AI Settings
- **provider**: `"ollama"` or `"lmstudio"`
- **model**: Model name
- **base_url**: API base URL
- **temperature**, **max_tokens**: Model parameters
- **prompt**: System message and instructions

### Interaction Settings
- Delays before/after interactions
- Wait timeouts

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

This will generate a Playwright test file in the `tests/` folder with a filename based on the start URL and timestamp (e.g., `www-ing-be-20260214-231528.spec.ts`).

### Running Generated Tests

Use the interactive test selector:

```bash
npm test
```

This opens a selection menu where you can:
- Use arrow keys to navigate
- Press Enter to run a specific test file

Or run tests directly:

```bash
npx playwright test tests/www-ing-be-20260214-231528.spec.ts
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

1. **Parse Test Plan**: Reads and parses the markdown test plan (`test-plan/test-plan.md`)
2. **Generate Test Code**: Converts test plan steps into Playwright test code
   - Each step becomes a separate `describe` block
   - Generates specific locators (prioritizing ID, XPath, selector+href+text combinations)
   - Includes cookie setup matching the planner's approach
3. **Create Assertions**: Generates assertions for:
   - Expected URLs
   - Page titles
   - Key elements (headings)
   - Notable elements (AI-identified important page elements)
4. **Output Test Suite**: Writes a ready-to-run Playwright test file with descriptive names

## Key Features

### Smart Locator Generation
- Prioritizes specific locators (ID, XPath, selector+href+text combinations)
- Automatically filters out unstable selectors (random hash IDs)
- Uses exact href matching to avoid subpath conflicts
- Falls back to `.first()` when multiple matches are possible

### Cookie Handling
- Sets cookies before page load to bypass popups
- Uses both JavaScript injection and Playwright API
- Automatically reloads page after setting cookies

### Notable Elements
- AI identifies important page elements during exploration
- These elements are included in test plans for verification
- Helps ensure page structure hasn't changed

### Test Plan Format
- Markdown-based test plans with clear structure
- Includes steps to reproduce and expected results
- Contains all necessary selectors, XPaths, and element details

## Architecture Documentation

For detailed information about:
- Component architecture and responsibilities
- Execution flow and sequence diagrams
- Data structures and communication patterns
- Extension points

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)


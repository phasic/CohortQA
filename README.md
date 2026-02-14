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

```bash
npm start -- -u <url>
```

Example:
```bash
npm start -- -u https://example.com
```

## How It Works

1. **Browser Initialization**: Launches a Chromium browser (headed or headless)
2. **DOM Scanning**: Recursively scans the DOM including shadow DOM for interactable elements
3. **Element Extraction**: Filters elements based on guardrails (size, visibility, excluded selectors)
4. **AI Selection**: Sends element list to QWEN 2.5 Coder 14B which returns which element to interact with and how
5. **Interaction**: Performs the action (click, type, select, etc.)
6. **Navigation Tracking**: Tracks URL changes and stops after max navigations

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


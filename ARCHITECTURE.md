# Cohort QA Architecture

This document provides a comprehensive overview of the Cohort QA system architecture, including modules, AI components, data flow, and configuration.

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Core Modules](#core-modules)
3. [AI Components](#ai-components)
4. [Data Flow](#data-flow)
5. [Configuration System](#configuration-system)
6. [AI Usage Matrix](#ai-usage-matrix)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI (cli.ts)                            │
│              Entry point for all commands                       │
└────────────┬──────────────────────────────────────────────────┘
             │
             ├──────────────────┬──────────────────┬──────────────┐
             │                  │                  │              │
             ▼                  ▼                  ▼              ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │   Planner   │   │  Generator   │   │   Healer     │   │  Interactive │
    │             │   │              │   │              │   │     Mode     │
    └──────┬──────┘   └──────┬───────┘   └──────┬───────┘   └──────────────┘
           │                 │                   │
           │                 │                   │
           ▼                 ▼                   ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    AI System                                │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
    │  │ DecisionMaker│  │TestCodeGenAI  │  │TestHealerAI  │    │
    │  │  (Planner)   │  │ (Generator)   │  │  (Healer)    │    │
    │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
    │         │                  │                  │            │
    │  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐    │
    │  │PrefixGenerator│  │              │  │              │    │
    │  │   (TTS)      │  │              │  │              │    │
    │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
    │         │                  │                  │            │
    │         ▼                  ▼                  ▼            │
    │  ┌────────────────────────────────────────────────────┐   │
    │  │           AI Provider Factory                      │   │
    │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │
    │  │  │ OpenAI   │  │Anthropic │  │ Ollama   │        │   │
    │  │  │ Client   │  │ Client   │  │ Client   │        │   │
    │  │  └──────────┘  └──────────┘  └──────────┘        │   │
    │  └────────────────────────────────────────────────────┘   │
    │         │                  │                  │            │
    │         ▼                  ▼                  ▼            │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
    │  │ TTS Providers│  │  Heuristics │  │  Heuristics  │    │
    │  │  (TTS)       │  │ (Generator) │  │  (Healer)    │    │
    │  └──────────────┘  └──────────────┘  └──────────────┘    │
    └─────────────────────────────────────────────────────────────┘
           │
           ▼
    ┌─────────────────────────────────────────────────────────────┐
    │              Configuration System (config.yaml)             │
    │  - AI Provider Selection (Planner & TTS)                    │
    │  - Model Selection                                           │
    │  - Voice Selection (TTS)                                     │
    │  - Planner Settings                                          │
    └─────────────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. Planner (`src/planner/`)

The Planner module explores web applications and generates test plans.

#### Components:

- **`Planner.ts`** - Main orchestrator
  - Manages browser sessions
  - Coordinates exploration flow
  - Tracks visited pages
  - Generates test plans

- **`elements/ElementDetector.ts`** - Finds interactive elements
  - Scans DOM (including Shadow DOM)
  - Filters by visibility and interactivity
  - Excludes elements in ignored tags (header, nav, aside, footer)

- **`interactions/InteractionHandler.ts`** - Handles user interactions
  - Clicks buttons, links, inputs
  - Fills form fields
  - Handles navigation

- **`interactions/CookieHandler.ts`** - Manages cookie consent
  - Detects and dismisses cookie popups
  - Sets default cookie preferences

- **`navigation/NavigationManager.ts`** - Manages page navigation
  - Ensures same-domain navigation
  - Tracks URL changes
  - Forces navigation when stuck

- **`analysis/PageAnalyzer.ts`** - Analyzes page structure
  - Extracts page title, URL
  - Finds buttons, links, inputs, forms
  - Collects headings

- **`generation/TestPlanGenerator.ts`** - Generates test scenarios
  - Creates page load scenarios
  - Creates navigation scenarios
  - Creates interaction scenarios

- **`generation/MarkdownExporter.ts`** - Exports test plan to Markdown

- **`utils/InteractionTracker.ts`** - Tracks recent interactions
  - Prevents repeating same actions
  - Maintains interaction history

- **`utils/UrlNormalizer.ts`** - Normalizes URLs
  - Removes fragments, query params
  - Handles trailing slashes

#### AI Integration:

- Uses **DecisionMaker** to select best elements to interact with
- AI analyzes page context and recommends actions
- Falls back to heuristics if AI unavailable

---

### 2. Generator (`src/generator.ts`)

Transforms Markdown test plans into executable Playwright tests.

#### Components:

- **`Generator.ts`** - Main orchestrator
  - Parses Markdown test plans
  - Coordinates test code generation
  - Creates timestamped output directories
  - Writes `.spec.ts` files

- **`generator/TestCodeGenerator.ts`** - AI-powered test code generator
  - Uses AI to generate Playwright test code from scenarios
  - Analyzes test scenarios and generates best-practice code
  - Falls back to heuristic generation if AI unavailable

#### Process:

1. Parses Markdown test plan
2. Extracts scenarios, steps, expected results
3. Generates Playwright test code (using AI if available)
4. Creates timestamped output directories
5. Writes `.spec.ts` files

#### Features:

- Converts navigation steps to `page.goto()`
- Converts click steps to `page.getByRole().click()`
- Generates assertions for expected results
- Includes page title verification
- Verifies button/link text before clicking
- AI-powered code generation with best practices

#### AI Integration:

- Uses **TestCodeGenerator** to generate test code using AI
- AI analyzes test scenarios and generates maintainable, best-practice code
- Falls back to heuristic-based code generation if AI unavailable

---

### 3. Healer (`src/healer/`)

Automatically fixes failing Playwright tests.

#### Components:

- **`Healer.ts`** - Main orchestrator
  - Manages test execution
  - Coordinates healing process
  - Iterates until tests pass or max iterations reached

- **`ai/TestHealerAI.ts`** - AI-powered test healer
  - Uses AI to intelligently fix broken tests
  - Analyzes test failures and suggests best selector strategies
  - Focuses on test coverage, maintainability, and best practices
  - Falls back to heuristic fixers if AI unavailable

- **`fixes/TestCodeFixer.ts`** - Orchestrates all fixers
  - Tries AI healing first (if available)
  - Falls back to heuristic fixers (SelectorFixer, NavigationFixer, etc.)

- **`fixes/SelectorFixer.ts`** - Fixes selector issues
- **`fixes/NavigationFixer.ts`** - Fixes navigation issues
- **`fixes/TimeoutFixer.ts`** - Fixes timeout issues
- **`fixes/AssertionFixer.ts`** - Fixes assertion issues
- **`fixes/WaitTimeFixer.ts`** - Adds wait times for flaky tests

- **`runner/TestRunner.ts`** - Runs Playwright tests
- **`parsing/TestFailureParser.ts`** - Parses test failures
- **`utils/FileResolver.ts`** - Resolves test file paths
- **`utils/AnsiCodeStripper.ts`** - Strips ANSI codes from output

#### Process:

1. Runs Playwright tests
2. Parses test failures
3. Attempts to fix using AI (if available)
4. Falls back to heuristic fixers if AI unavailable
5. Re-runs tests to verify fixes
6. Iterates up to max iterations

#### Features:

- Detects selector failures
- Updates locators based on error messages
- Handles element visibility issues
- Retries with different strategies
- AI-powered intelligent selector selection
- Best-practice code generation

#### AI Integration:

- Uses **TestHealerAI** to intelligently fix broken tests
- AI analyzes test failures and suggests best selector strategies
- Focuses on test coverage, maintainability, and Playwright best practices
- Falls back to heuristic-based fixers if AI unavailable

---

## AI Components

### 1. DecisionMaker (`src/ai/DecisionMaker.ts`)

**Purpose**: Selects the best interactive element to click/interact with during exploration.

**Used By**: Planner module

**AI Providers Supported**:
- **Ollama** (default, free, local)
  - Model: `mistral` (configurable via `config.yaml`)
  - API: `http://localhost:11434/api/chat`
- **OpenAI**
  - Model: `gpt-4o-mini` (configurable)
  - API: `https://api.openai.com/v1/chat/completions`
- **Anthropic Claude**
  - Model: `claude-3-haiku-20240307` (configurable)
  - API: `https://api.anthropic.com/v1/messages`

**Input**:
- Page URL
- Page title
- Page headings (h1-h3)
- List of interactive elements (buttons, links, inputs)
- Recent interaction history

**Output**:
- Recommended element index
- Reasoning (optional)

**Fallback**:
- If AI unavailable → **HeuristicSelector** (prioritizes links, then buttons)
- If heuristics fail → Random selection

**Configuration**:
```yaml
ai:
  planner:
    provider: ollama  # or openai, anthropic
    model: mistral     # model name
```

---

### 2. PrefixGenerator (`src/utils/tts/ai/PrefixGenerator.ts`)

**Purpose**: Generates dynamic, personality-driven prefixes for TTS speech (e.g., "Oh!", "Hmm,", "Let me try").

**Used By**: TTS module

**AI Providers Supported**:
- **OpenAI** (if `OPENAI_API_KEY` set)
  - Model: `gpt-4o-mini` or `gpt-3.5-turbo`
- **Anthropic Claude** (if `ANTHROPIC_API_KEY` set)
  - Model: `claude-3-haiku-20240307`
- **Ollama** (if available)
  - Model: `mistral`

**Input**:
- Personality type: `realizing`, `deciding`, `acting`
- Context text (what the AI is about to say)

**Output**:
- Dynamic prefix (e.g., "Oh!", "Hmm,", "Let me try", "I think")

**Fallback**:
- If AI unavailable → Uses hardcoded fallback prefixes from `config.yaml`

**Caching**:
- Uses `PrefixCache` to cache AI-generated prefixes
- Reduces API calls for similar contexts

**Configuration**:
- Uses same AI provider as Planner (can be different)
- Configured via `config.yaml` (but currently uses Planner's provider)

---

### 3. TTS Providers (`src/utils/tts/providers/`)

**Purpose**: Text-to-Speech for AI personality (speaks thoughts and actions).

**Used By**: Planner module (when `--tts` flag enabled)

**Providers**:

1. **OpenAI TTS** (preferred if API key available)
   - Model: `tts-1` or `tts-1-hd`
   - Voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`
   - Natural, high-quality voices

2. **Piper TTS** (free, offline)
   - Voices: `amy`, `lessac`, `joe` (or custom .onnx files)
   - Natural-sounding, offline
   - Requires local installation

3. **macOS `say`** (fallback)
   - Voices: `Samantha`, `Alex`, `Victoria`, etc.
   - Basic robotic voice
   - Always available on macOS

**Configuration**:
```yaml
ai:
  tts:
    provider: openai  # or piper, macos
    model: tts-1      # for OpenAI
    voice: nova       # voice name
```

---

## Data Flow

### Planner Exploration Flow

```
1. CLI → Planner.initialize()
   ├─ Launches browser
   ├─ Initializes DecisionMaker (AI)
   ├─ Initializes TTS (if enabled)
   └─ Prints configuration box

2. Planner.explore()
   ├─ Navigates to initial URL
   ├─ Analyzes page (PageAnalyzer)
   └─ Stores page info

3. Loop: While navigations < maxNavigations
   ├─ ElementDetector.findInteractiveElements()
   │  └─ Returns list of buttons, links, inputs
   │
   ├─ DecisionMaker.recommendBestInteraction()
   │  ├─ If AI enabled:
   │  │  ├─ Builds PageContext (URL, title, headings, elements)
   │  │  ├─ Calls AI Provider (Ollama/OpenAI/Anthropic)
   │  │  ├─ AI returns recommended element index
   │  │  └─ Returns recommendation
   │  └─ If AI disabled/unavailable:
   │     └─ HeuristicSelector.selectBestElement()
   │
   ├─ InteractionHandler.interactWithElement()
   │  ├─ Verifies element exists
   │  ├─ Clicks/fills element
   │  └─ Waits for navigation/response
   │
   ├─ NavigationManager.ensureSameDomain()
   │  └─ Verifies still on same domain
   │
   ├─ If URL changed:
   │  ├─ PageAnalyzer.analyzePage()
   │  ├─ Stores page info
   │  └─ Increments navigation count
   │
   └─ InteractionTracker.rememberInteraction()
      └─ Records interaction to avoid repeats

4. TestPlanGenerator.generateScenarios()
   ├─ Creates page load scenarios
   ├─ Creates navigation scenarios
   └─ Creates interaction scenarios

5. MarkdownExporter.export()
   └─ Writes test plan to Markdown file
```

### Generator Flow

```
1. CLI → Generator.generateTests()
   ├─ Parses Markdown test plan
   ├─ Extracts scenarios
   └─ For each scenario:
      ├─ TestCodeGenerator.generate()
      │  ├─ If AI enabled:
      │  │  ├─ Builds prompt with scenario context
      │  │  ├─ Calls AI Provider (Ollama/OpenAI/Anthropic)
      │  │  ├─ AI generates complete test code
      │  │  ├─ Validates code completeness
      │  │  └─ Returns AI-generated code
      │  └─ If AI disabled/unavailable:
      │     └─ Falls back to heuristic generation
      │        ├─ Converts steps to Playwright code
      │        ├─ Generates assertions
      │        └─ Returns heuristic-generated code
      └─ Writes .spec.ts file
```

### Healer Flow

```
1. CLI → Healer.healAllFailures()
   ├─ TestRunner.runTests()
   │  └─ Executes Playwright tests
   │
   ├─ TestFailureParser.parseFailures()
   │  └─ Extracts test failures from output
   │
   └─ For each failure:
      ├─ TestCodeFixer.fix()
      │  ├─ If AI enabled:
      │  │  ├─ TestHealerAI.heal()
      │  │  │  ├─ Builds prompt with test code, error, context
      │  │  │  ├─ Calls AI Provider (Ollama/OpenAI/Anthropic)
      │  │  │  ├─ AI analyzes failure and suggests fixes
      │  │  │  ├─ AI generates fixed code with best selectors
      │  │  │  ├─ Validates code completeness
      │  │  │  └─ Returns AI-fixed code
      │  │  └─ Returns AI fix result
      │  └─ If AI disabled/unavailable:
      │     └─ Falls back to heuristic fixers
      │        ├─ SelectorFixer.fix()
      │        ├─ NavigationFixer.fix()
      │        ├─ TimeoutFixer.fix()
      │        ├─ AssertionFixer.fix()
      │        └─ WaitTimeFixer.fix()
      │
      ├─ Writes fixed code to file
      └─ Re-runs tests to verify fix
```

### TTS Flow (when enabled)

```
1. Planner finds interactive elements
   └─ TTS.speakAnalysis()
      ├─ "Oh! X elements found"
      ├─ PrefixGenerator.generatePrefix("realizing")
      │  └─ Calls AI (if available) or uses fallback
      └─ TTS Provider speaks text

2. Planner selects element
   └─ TTS.speakAction()
      ├─ PrefixGenerator.generatePrefix("acting")
      └─ TTS Provider speaks action

3. Planner completes exploration
   └─ TTS.speak()
      └─ TTS Provider speaks completion message
```

---

## Configuration System

### Configuration Hierarchy

```
1. Environment Variables (highest priority)
   ├─ PLANNER_AI_PROVIDER
   ├─ PLANNER_AI_MODEL
   ├─ TTS_PROVIDER
   ├─ TTS_MODEL
   ├─ TTS_VOICE
   └─ OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.

2. config.yaml (single source of truth)
   ├─ ai.planner.provider
   ├─ ai.planner.model
   ├─ ai.generator.provider
   ├─ ai.generator.model
   ├─ ai.healer.provider
   ├─ ai.healer.model
   ├─ ai.tts.provider
   ├─ ai.tts.model
   ├─ ai.tts.voice
   └─ planner.* settings

3. Defaults (lowest priority)
   ├─ Planner: Ollama + mistral
   └─ TTS: OpenAI (if API key) → Piper → macOS
```

### Configuration File Structure

```yaml
# config.yaml
ai:
  planner:
    provider: ollama  # [heuristic, ollama, openai, anthropic]
    model: mistral    # model name
  
  generator:
    provider: heuristic  # [heuristic, ollama, openai, anthropic]
    model: mistral    # model name
  
  healer:
    provider: heuristic  # [heuristic, ollama, openai, anthropic]
    model: mistral    # model name
  
  tts:
    provider: openai  # [openai, piper, macos]
    model: tts-1      # for OpenAI: [tts-1, tts-1-hd]
    voice: nova       # OpenAI: [alloy, echo, fable, onyx, nova, shimmer]
                      # Piper: [amy, lessac, joe]
                      # macOS: [Samantha, Alex, Victoria, etc.]

planner:
  maxClicks: 50
  maxConsecutiveFailures: 10
  ignoredTags: [header, nav, aside, footer, dbs-top-bar]
  # ... more settings

tts:
  # Technical settings (paths, shortcuts, fallbacks)
  # Provider/model/voice are in ai.tts above
```

---

## AI Usage Matrix

| Component | AI Used? | Provider | Model | Purpose | Fallback |
|-----------|----------|----------|-------|---------|----------|
| **Planner - Element Selection** | ✅ Yes | Ollama/OpenAI/Anthropic | `mistral`/`gpt-4o-mini`/`claude-3-haiku` | Selects best element to interact with | HeuristicSelector → Random |
| **Generator - Test Code Generation** | ✅ Yes | Ollama/OpenAI/Anthropic | `mistral`/`gpt-4o-mini`/`claude-3-haiku` | Generates Playwright test code from scenarios | Heuristic code generation |
| **Healer - Test Fixing** | ✅ Yes | Ollama/OpenAI/Anthropic | `mistral`/`gpt-4o-mini`/`claude-3-haiku` | Intelligently fixes broken tests with best selectors | Heuristic fixers (SelectorFixer, NavigationFixer, etc.) |
| **TTS - Prefix Generation** | ✅ Yes | Same as Planner | Same as Planner | Generates dynamic speech prefixes | Hardcoded fallbacks |
| **TTS - Speech Synthesis** | ❌ No | OpenAI TTS API | `tts-1`/`tts-1-hd` | Converts text to speech | Piper → macOS `say` |

### When AI is Used

1. **Planner Element Selection** (when `--ai` flag enabled):
   - Every time planner needs to select an element to interact with
   - AI receives page context and element list
   - AI returns recommendation with reasoning

2. **Generator Test Code Generation** (when AI provider configured):
   - For each test scenario in the Markdown plan
   - AI receives scenario context (steps, expected results)
   - AI generates complete Playwright test code following best practices
   - Validates code completeness before saving

3. **Healer Test Fixing** (when AI provider configured):
   - For each test failure detected
   - AI receives test code, error message, and context
   - AI analyzes failure and suggests best selector strategies
   - AI generates fixed code focusing on coverage and maintainability
   - Validates code completeness before saving

4. **TTS Prefix Generation** (when `--tts` flag enabled):
   - When TTS needs to speak with personality
   - Generates prefixes like "Oh!", "Hmm,", "Let me try"
   - Cached to reduce API calls

### When AI is NOT Used

1. **TTS Speech Synthesis**: Uses dedicated TTS APIs (not LLMs)
2. **Heuristic Fallbacks**: All AI components gracefully fall back to heuristics when AI is unavailable or disabled

---

## Module Dependencies

```
CLI
├─ Planner
│  ├─ DecisionMaker (AI)
│  │  ├─ ProviderFactory
│  │  │  ├─ OpenAIClient
│  │  │  ├─ AnthropicClient
│  │  │  └─ OllamaClient
│  │  └─ HeuristicSelector (fallback)
│  ├─ ElementDetector
│  ├─ InteractionHandler
│  ├─ NavigationManager
│  ├─ PageAnalyzer
│  ├─ TestPlanGenerator
│  ├─ MarkdownExporter
│  └─ TTS (optional)
│     ├─ PrefixGenerator (AI)
│     │  └─ Uses same AI providers as DecisionMaker
│     ├─ OpenAIProvider
│     ├─ PiperProvider
│     └─ MacOSProvider
├─ Generator
│  ├─ TestCodeGenerator (AI)
│  │  ├─ ProviderFactory
│  │  │  ├─ OpenAIClient
│  │  │  ├─ AnthropicClient
│  │  │  └─ OllamaClient
│  │  └─ Heuristic generation (fallback)
│  └─ Generator.ts (orchestrator)
└─ Healer
   ├─ TestHealerAI (AI)
   │  ├─ ProviderFactory
   │  │  ├─ OpenAIClient
   │  │  ├─ AnthropicClient
   │  │  └─ OllamaClient
   │  └─ Heuristic fixers (fallback)
   ├─ TestCodeFixer (orchestrator)
   ├─ SelectorFixer
   ├─ NavigationFixer
   ├─ TimeoutFixer
   ├─ AssertionFixer
   ├─ WaitTimeFixer
   ├─ TestRunner
   └─ TestFailureParser

Config System
├─ config-loader.ts
│  └─ Reads config.yaml
└─ ai-config.ts
   └─ Wrapper for config-loader
```

---

## Key Design Decisions

1. **Separate AI Providers for Planner and TTS**:
   - Planner can use Ollama (free, local)
   - TTS can use OpenAI (better voices)
   - Configured independently in `config.yaml`

2. **Graceful Degradation**:
   - AI → Heuristics → Random (for element selection)
   - AI prefixes → Hardcoded fallbacks (for TTS)
   - OpenAI TTS → Piper → macOS `say` (for speech)

3. **Modular Architecture**:
   - Each component is independent
   - Easy to swap implementations
   - Clear separation of concerns

4. **Configuration Hierarchy**:
   - Environment variables override config.yaml
   - config.yaml is single source of truth
   - Sensible defaults for everything

---

## File Organization

```
src/
├── cli.ts                    # CLI entry point
├── planner/                  # Planner module
│   ├── Planner.ts           # Main orchestrator
│   ├── elements/            # Element detection
│   ├── interactions/        # User interactions
│   ├── navigation/          # Navigation management
│   ├── analysis/            # Page analysis
│   ├── generation/         # Test plan generation
│   └── utils/              # Utilities
├── generator.ts             # Test code generator (orchestrator)
├── generator/               # Generator module
│   └── TestCodeGenerator.ts # AI-powered test code generator
├── healer/                  # Healer module
│   ├── Healer.ts           # Main orchestrator
│   ├── ai/                 # AI-powered healing
│   │   └── TestHealerAI.ts # AI test healer
│   ├── fixes/              # Heuristic fixers
│   │   ├── TestCodeFixer.ts # Orchestrator
│   │   ├── SelectorFixer.ts
│   │   ├── NavigationFixer.ts
│   │   ├── TimeoutFixer.ts
│   │   ├── AssertionFixer.ts
│   │   └── WaitTimeFixer.ts
│   ├── runner/             # Test execution
│   │   └── TestRunner.ts
│   ├── parsing/            # Failure parsing
│   │   └── TestFailureParser.ts
│   └── utils/              # Utilities
│       ├── FileResolver.ts
│       └── AnsiCodeStripper.ts
├── ai/                     # AI components
│   ├── DecisionMaker.ts    # Element selection AI (Planner)
│   ├── ProviderFactory.ts  # AI provider factory
│   ├── clients/           # AI client implementations
│   │   ├── OpenAIClient.ts
│   │   ├── AnthropicClient.ts
│   │   └── OllamaClient.ts
│   └── HeuristicSelector.ts # Fallback selector
├── utils/tts/              # Text-to-Speech
│   ├── TTS.ts             # Main TTS orchestrator
│   ├── ai/                # AI prefix generation
│   ├── providers/          # TTS providers
│   └── cache/             # Prefix caching
└── config/                 # Configuration
    ├── config-loader.ts    # YAML config loader
    └── ai-config.ts        # AI config wrapper
```

---

## Summary

- **Planner**: Uses AI (Ollama/OpenAI/Anthropic) for smart element selection, falls back to heuristics
- **Generator**: Uses AI (Ollama/OpenAI/Anthropic) for intelligent test code generation, falls back to heuristics
- **Healer**: Uses AI (Ollama/OpenAI/Anthropic) for intelligent test fixing with best selectors, falls back to heuristic fixers
- **TTS**: Uses AI for prefix generation, dedicated APIs for speech synthesis
- **Configuration**: Centralized in `config.yaml` with environment variable overrides
- **AI Providers**: Each component (Planner, Generator, Healer) can use independent AI providers and models

The system is designed to work with or without AI, gracefully degrading to heuristics when AI is unavailable. All AI components support the `heuristic` provider option to explicitly disable AI and use heuristics only.


# Cohort QA Architecture

## Overview

Cohort QA is an AI-powered web exploration system that automatically navigates through web applications by:
1. Scanning the DOM for interactable elements
2. Using AI to select which element to interact with
3. Performing the interaction
4. Tracking navigations until a limit is reached

## System Architecture Flow

The Cohort QA system consists of three main components that work together:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Cohort QA System                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   PLANNER     │      │   GENERATOR    │      │   HEALER      │
│               │      │                │      │   (Future)    │
│ Explores      │─────▶│ Reads test     │─────▶│ Fixes broken │
│ website       │      │ plan, generates│      │ tests         │
│               │      │ Playwright     │      │               │
│ Generates     │      │ test suite     │      │ Updates       │
│ test plan     │      │                │      │ selectors     │
│ (markdown)    │      │                │      │               │
└───────────────┘      └───────────────┘      └───────────────┘
        │                      │                      │
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ test-plan/    │      │ tests/        │      │ tests/        │
│ test-plan.md  │      │ *.spec.ts     │      │ *.spec.ts     │
│               │      │               │      │ (updated)     │
└───────────────┘      └───────────────┘      └───────────────┘
```

### Component Flow

```mermaid
flowchart TD
    Start([Start]) --> Planner[Planner Component]
    
    Planner --> |1. Explore website| Explore[Browser Automation]
    Explore --> |2. Scan DOM| Scan[DOM Scanner]
    Scan --> |3. Extract elements| Extract[Element Extractor]
    Extract --> |4. AI selection| AI[AI Client]
    AI --> |5. Interact| Interact[Interaction Handler]
    Interact --> |6. Track navigation| Track[Navigation Tracker]
    Track --> |Loop until max| Extract
    Track --> |7. Generate test plan| TestPlan[Test Plan Generator]
    TestPlan --> |Output| TestPlanMD[test-plan/test-plan.md]
    
    TestPlanMD --> Generator[Generator Component]
    
    Generator --> |1. Parse markdown| Parser[Test Plan Parser]
    Parser --> |2. Generate code| CodeGen[Playwright Generator]
    CodeGen --> |3. Create locators| Locators[Smart Locator Generation]
    Locators --> |4. Generate assertions| Assertions[Assertion Generator]
    Assertions --> |Output| TestFile[tests/*.spec.ts]
    
    TestFile --> |Run tests| RunTests[Playwright Test Runner]
    RunTests --> |Tests pass?| TestResult{Test Result}
    
    TestResult -->|Pass| Success([Success])
    TestResult -->|Fail| Healer[Healer Component - Future]
    
    Healer --> |1. Analyze failures| Analyze[Failure Analyzer]
    Analyze --> |2. Identify broken selectors| Identify[Selector Identifier]
    Identify --> |3. Find new selectors| FindNew[Selector Finder]
    FindNew --> |4. Update test file| Update[Test Updater]
    Update --> |Output| TestFileUpdated[tests/*.spec.ts - Updated]
    TestFileUpdated --> RunTests
    
    style Planner fill:#e1f5ff
    style Generator fill:#fff4e1
    style Healer fill:#ffe1f5
    style TestPlanMD fill:#e8f5e9
    style TestFile fill:#e8f5e9
    style Success fill:#c8e6c9
```

### Data Flow Between Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         PLANNER                                 │
│                                                                  │
│  Input:                                                          │
│  • config.yaml                                                   │
│  • Start URL (command line or config)                           │
│                                                                  │
│  Process:                                                        │
│  • Browser automation                                            │
│  • DOM scanning (including shadow DOM)                          │
│  • Element extraction with guardrails                            │
│  • AI-powered element selection                                  │
│  • Interaction execution                                         │
│  • Navigation tracking                                           │
│  • Notable element identification                                │
│                                                                  │
│  Output:                                                         │
│  └──▶ test-plan/test-plan.md                                    │
│      • Start URL                                                 │
│      • Steps with actions (click, type, etc.)                    │
│      • Element details (selector, text, href, XPath, ID)        │
│      • Expected results (URL, title, notable elements)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       GENERATOR                                  │
│                                                                  │
│  Input:                                                          │
│  • test-plan/test-plan.md                                        │
│  • config.yaml (for cookie settings)                            │
│                                                                  │
│  Process:                                                        │
│  • Parse markdown test plan                                      │
│  • Generate Playwright test code                                 │
│  • Create smart locators (ID, XPath, selector+href+text)         │
│  • Generate cookie setup code                                    │
│  • Create assertions for expected results                        │
│                                                                  │
│  Output:                                                         │
│  └──▶ tests/[url-timestamp].spec.ts                             │
│      • Descriptive test blocks                                   │
│      • Specific locators to avoid strict mode violations         │
│      • Cookie configuration                                      │
│      • Assertions for URLs, titles, and notable elements        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        HEALER                                    │
│                      (Future Component)                          │
│                                                                  │
│  Input:                                                          │
│  • tests/*.spec.ts (failing tests)                              │
│  • test-plan/test-plan.md (original plan)                       │
│  • Test execution results                                        │
│                                                                  │
│  Process:                                                        │
│  • Analyze test failures                                         │
│  • Identify broken selectors                                    │
│  • Re-scan DOM to find new selectors                            │
│  • Update test file with new locators                            │
│  • Verify fixes work                                            │
│                                                                  │
│  Output:                                                         │
│  └──▶ tests/*.spec.ts (updated)                                  │
│      • Fixed locators                                            │
│      • New selectors that work                                   │
│      • Updated assertions if needed                              │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

The system is organized into two main components:

### Planner Component (`src/planner/`)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Planner (planner/index.ts)                    │
│              Orchestrates web exploration flow                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌─────────────────────┼─────────────────────┐
        │                       │                     │
        ▼                       ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Config     │      │   Browser    │      │   Scanner    │
│   Loader     │      │  Controller  │      │   (DOM)      │
└──────────────┘      └──────────────┘      └──────────────┘
                             │
        ┌─────────────────────┼─────────────────────┐
        │                       │                     │
        ▼                       ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Extractor   │      │  AI Client    │      │ Interaction  │
│  (Guardrails)│      │ (Ollama/LM)   │      │   Handler    │
└──────────────┘      └──────────────┘      └──────────────┘
                             │
                             ▼
                    ┌──────────────┐
                    │ Navigation   │
                    │   Tracker    │
                    └──────────────┘
                             │
                             ▼
                    ┌──────────────┐
                    │  Test Plan   │
                    │  Generator   │
                    └──────────────┘
```

### Generator Component (`src/generator/`)

```
┌─────────────────────────────────────────────────────────────────┐
│                  Generator (generator/index.ts)                  │
│            Converts test plans to Playwright tests               │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌─────────────────────┼─────────────────────┐
        │                       │                     │
        ▼                       ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Test Plan    │      │ Playwright   │      │   Config     │
│  Parser      │      │  Generator   │      │   Loader     │
└──────────────┘      └──────────────┘      └──────────────┘
```

## Component Responsibilities

### Planner Components (`src/planner/`)

#### Config Loader (`planner/config.ts`)
- Loads and parses `config.yaml`
- Provides configuration to all components
- Validates configuration structure

#### Browser Controller (`planner/browser/BrowserController.ts`)
- Manages Playwright browser instance
- Handles page navigation
- **Sets cookies before page load** (via JavaScript injection and Playwright API)
- Provides page access to other components
- Manages browser lifecycle (init/close)

#### DOM Scanner (`planner/scanner/DOMScanner.ts`)
- Scans the DOM including shadow DOM
- Respects blacklisted tags (ignores element and all children)
- Uses `interactable_elements` selectors from config (whitelist approach)
- Extracts interactable element information
- **Collects notable elements** for AI analysis
- Returns structured element data

#### Element Extractor (`planner/extractor/ElementExtractor.ts`)
- Applies guardrails to extracted elements:
  - **Domain restriction**: Prevents navigation away from starting domain
  - **Path restriction**: Enforces `stay_on_path` if configured
  - **Visited URL avoidance**: Filters out links to already visited URLs
  - **Random hash ID filtering**: Removes unstable selectors
- Filters by visibility (if configured)
- Limits number of elements (max_elements)
- Returns filtered element list

#### AI Client (`planner/ai/AIClient.ts`)
- Communicates with AI providers (Ollama or LM Studio)
- Sends element list and context to AI model
- **Identifies notable elements** on pages
- Parses AI response (JSON)
- Returns structured interaction decision

#### Interaction Handler (`planner/interaction/InteractionHandler.ts`)
- Performs browser interactions (click, type, select, etc.)
- **Handles shadow DOM elements** with recursive search
- Handles interaction delays
- Manages error recovery
- Waits for page changes after interaction

#### Navigation Tracker (`planner/tracker/NavigationTracker.ts`)
- Tracks visited URLs
- Normalizes URLs for comparison
- Counts navigation events
- Determines when max navigations or max loops reached

#### Planner Main (`planner/index.ts`)
- Orchestrates the exploration flow
- Generates test plan in markdown format
- Tracks loop summaries and timing
- Outputs summary table at end of run

### Generator Components (`src/generator/`)

#### Test Plan Parser (`generator/TestPlanParser.ts`)
- Reads and parses `test-plan/test-plan.md`
- Extracts start URL, steps, actions, and expected results
- Parses element information (selector, text, href, XPath, ID, etc.)
- Parses notable elements and key elements

#### Playwright Generator (`generator/PlaywrightGenerator.ts`)
- Generates Playwright test code from parsed test plan
- **Smart locator generation** with multiple strategies:
  1. ID (most specific)
  2. XPath (very specific)
  3. Selector + href + text (most specific combination)
  4. Selector + href (exact match)
  5. Selector + text
  6. Href + text filtering
  7. Text-based role locators (with exact matching)
- **Cookie setup**: Generates cookie configuration matching planner
- Creates descriptive test and describe block names
- Generates assertions for URLs, titles, and notable elements

#### Generator Main (`generator/index.ts`)
- Entry point for generator script
- Loads config for cookie settings
- Orchestrates parsing and generation
- Outputs test file with timestamp-based naming

## Execution Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Main as Main Script
    participant Config as Config Loader
    participant Browser as Browser Controller
    participant Scanner as DOM Scanner
    participant Extractor as Element Extractor
    participant AI as AI Client
    participant Handler as Interaction Handler
    participant Tracker as Navigation Tracker

    Main->>Config: loadConfig()
    Config-->>Main: config object
    
    Main->>Browser: initialize()
    Browser->>Browser: launch browser
    Browser-->>Main: browser ready
    
    Main->>Browser: navigateTo(url)
    Browser->>Browser: page.goto(url)
    Browser-->>Main: navigation complete
    
    Main->>Tracker: trackNavigation(url)
    Tracker-->>Main: navigation count
    
    loop Until max navigations
        Main->>Scanner: scanDOM(page)
        Scanner->>Scanner: querySelectorAll(whitelist)
        Scanner->>Scanner: scan shadow DOM
        Scanner-->>Main: allElements[]
        
        Main->>Extractor: extract(allElements)
        Extractor->>Extractor: filter by visibility
        Extractor->>Extractor: limit count
        Extractor-->>Main: filteredElements[]
        
        Main->>Tracker: getVisitedUrls()
        Tracker-->>Main: visitedUrls[]
        
        Main->>AI: selectElement(elements, visitedUrls)
        AI->>AI: buildPrompt()
        AI->>AI: callOllama(prompt)
        AI->>AI: parseResponse()
        AI-->>Main: aiResponse {elementIndex, action, reasoning}
        
        Main->>Handler: interact(page, element, aiResponse)
        Handler->>Handler: wait delay_before
        Handler->>Browser: perform action (click/type/etc)
        Browser-->>Handler: action complete
        Handler->>Handler: wait delay_after
        Handler->>Handler: wait wait_timeout
        Handler-->>Main: interaction complete
        
        Main->>Browser: getCurrentUrl()
        Browser-->>Main: currentUrl
        
        Main->>Tracker: trackNavigation(currentUrl)
        alt New URL detected
            Tracker->>Tracker: increment count
            Tracker-->>Main: navigation count++
        else Same URL
            Tracker-->>Main: no navigation
        end
        
        Main->>Tracker: hasReachedMax(maxNavigations)
        alt Max reached
            Tracker-->>Main: true (stop loop)
        else Continue
            Tracker-->>Main: false (continue)
        end
    end
    
    Main->>Browser: close()
    Browser->>Browser: browser.close()
    Browser-->>Main: closed
```

## Data Flow

### Element Data Structure

```
InteractableElement
├── index: number
├── tag: string
├── type?: string (for inputs)
├── text?: string
├── selector: string
├── href?: string
├── id?: string
├── className?: string
├── ariaLabel?: string
├── role?: string
├── isVisible: boolean
└── boundingBox?: {x, y, width, height}
```

### AI Request/Response

**Request to AI:**
- System message (instructions)
- List of interactable elements with metadata
- Visited URLs list
- Instructions for JSON response format

**Response from AI:**
```json
{
  "elementIndex": 5,
  "action": "click",
  "value": null,
  "reasoning": "This link leads to a new page with product details"
}
```

## Configuration Flow

All components receive the `Config` object which contains:

```yaml
start_url:        # URL to start exploration from
stay_on_path:     # Optional path restriction

browser:          # Browser settings
  cookies:        # Array of cookie objects to set
  headless:       # Headless mode
  timeout:        # Browser timeout

navigation:       # Navigation settings
  max_navigations: # Maximum URL changes
  max_loops:      # Maximum loop iterations
  stay_on_domain: # Restrict to starting domain
  wait_after_navigation: # Wait time after navigation

element_extraction:  # Element extraction settings
  interactable_elements: # Selectors for interactable elements (whitelist)
  blacklist_tags:    # HTML tags to ignore
  notable_elements:  # Selectors for notable element identification
  enable_notable_elements: # Enable/disable notable elements
  include_invisible: # Include invisible elements
  max_elements:      # Maximum elements to extract

ai:              # AI model settings
  provider:      # "ollama" or "lmstudio"
  model:         # Model name
  base_url:      # API base URL
  temperature:   # Model temperature
  max_tokens:    # Maximum tokens
  max_elements_in_prompt: # Limit elements sent to AI
  prompt:        # System message and instructions

interaction:     # Interaction settings
  delay_before:  # Delay before interaction
  delay_after:   # Delay after interaction
  wait_timeout:  # Wait timeout
```

## Error Handling

- **Browser errors**: Caught in main script, browser is closed gracefully
- **AI errors**: Logged, script continues (would need fallback strategy)
- **Interaction errors**: Logged with fallback selectors attempted
- **DOM scanning errors**: Individual selector errors are ignored, continues scanning

## State Management

- **Navigation state**: Managed by `NavigationTracker` (visited URLs, count)
- **Browser state**: Managed by `BrowserController` (page, context, browser instance)
- **Configuration state**: Loaded once at startup, shared across components

## Test Plan Format

The planner generates a markdown test plan (`test-plan/test-plan.md`) with the following structure:

```markdown
# Test Plan

**Start URL**: https://example.com

## Steps to Reproduce

### Step 2: CLICK

**Action:** click on element
- **Selector**: `a.link-unstyled.font-md`
- **Text**: "Investing"
- **Link**: https://example.com/investing
- **XPath**: `/html/body/div[1]/a[2]`

**Expected Results:**
- **URL**: https://example.com/investing
- **Page Title**: "Investing - Example"
- **Notable Elements**:
  - `#main-heading` "Investing" - Main page heading
  - `.button-primary` "Get Started" - Call to action button
```

The generator reads this format and converts it to executable Playwright tests.

## Extension Points

The architecture supports extension through:

1. **Additional AI providers**: Extend `AIClient` with new provider methods (e.g., OpenAI, Anthropic)
2. **Custom selectors**: Modify `interactable_elements` and `notable_elements` in config
3. **New interaction types**: Add methods to `InteractionHandler`
4. **Additional guardrails**: Extend `ElementExtractor` filtering logic
5. **Custom navigation tracking**: Extend `NavigationTracker` with custom URL normalization
6. **Custom locator strategies**: Extend `PlaywrightGenerator.generateLocator()` with new strategies
7. **Test plan format**: Modify test plan structure and parser
8. **Parallel execution**: See [MULTITHREADING_ANALYSIS.md](MULTITHREADING_ANALYSIS.md) for parallel exploration strategies


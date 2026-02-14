# Cohort QA Architecture

## Overview

Cohort QA is an AI-powered web exploration system that automatically navigates through web applications by:
1. Scanning the DOM for interactable elements
2. Using AI to select which element to interact with
3. Performing the interaction
4. Tracking navigations until a limit is reached

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Main Script (index.ts)                   │
│                    Orchestrates the entire flow                  │
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
│  Extractor   │      │  AI Client   │      │ Interaction  │
│  (Guardrails)│      │  (QWEN 2.5)  │      │   Handler    │
└──────────────┘      └──────────────┘      └──────────────┘
                             │
                             ▼
                    ┌──────────────┐
                    │ Navigation   │
                    │   Tracker    │
                    └──────────────┘
```

## Component Responsibilities

### Config Loader (`config.ts`)
- Loads and parses `config.yaml`
- Provides configuration to all components
- Validates configuration structure

### Browser Controller (`browser/BrowserController.ts`)
- Manages Playwright browser instance
- Handles page navigation
- Provides page access to other components
- Manages browser lifecycle (init/close)

### DOM Scanner (`scanner/DOMScanner.ts`)
- Scans the DOM including shadow DOM
- Uses whitelist selectors from config
- Extracts interactable element information
- Returns structured element data

### Element Extractor (`extractor/ElementExtractor.ts`)
- Applies guardrails to extracted elements
- Filters by visibility (if configured)
- Limits number of elements (max_elements)
- Returns filtered element list

### AI Client (`ai/AIClient.ts`)
- Communicates with Ollama API
- Sends element list and context to AI model
- Parses AI response (JSON)
- Returns structured interaction decision

### Interaction Handler (`interaction/InteractionHandler.ts`)
- Performs browser interactions (click, type, select, etc.)
- Handles interaction delays
- Manages error recovery
- Waits for page changes after interaction

### Navigation Tracker (`tracker/NavigationTracker.ts`)
- Tracks visited URLs
- Normalizes URLs for comparison
- Counts navigation events
- Determines when max navigations reached

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
browser:          # Browser settings
navigation:       # Navigation limits
element_extraction:  # Whitelist selectors, visibility, max elements
ai:              # AI model settings, prompts
interaction:     # Delays and timeouts
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

## Extension Points

The architecture supports extension through:

1. **Additional AI providers**: Extend `AIClient` with new provider methods
2. **Custom selectors**: Modify `include_selectors` in config
3. **New interaction types**: Add methods to `InteractionHandler`
4. **Additional guardrails**: Extend `ElementExtractor` filtering logic
5. **Custom navigation tracking**: Extend `NavigationTracker` with custom URL normalization
6. **Parallel execution**: See [MULTITHREADING_ANALYSIS.md](MULTITHREADING_ANALYSIS.md) for parallel exploration strategies


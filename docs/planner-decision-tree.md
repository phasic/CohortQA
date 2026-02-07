# Planner Element Selection Decision Tree

This document describes the decision-making process for selecting which interactive element to click during web application exploration.

## Overview

The planner uses a multi-stage decision process to select elements, with AI-powered selection when available and heuristic fallbacks when not. The process includes duplicate avoidance, guardrails, and intelligent filtering.

## Decision Flow Diagram

```mermaid
flowchart TD
    Start([START: Page Interaction]) --> HandleCookie[Handle Cookie Popups]
    HandleCookie --> ElementDetector[ElementDetector.findInteractiveElements]
    ElementDetector --> FilterElements[Filter Elements<br/>- Ignored tags<br/>- Visibility<br/>- Interactivity<br/>- Shadow DOM]
    FilterElements --> ElementsFound{Elements Found?}
    
    ElementsFound -->|NO| RetryWait[Retry with longer wait]
    RetryWait --> StillNone{Still None?}
    StillNone -->|YES| ReturnFalse[Return false]
    StillNone -->|NO| FilterElements
    
    ElementsFound -->|YES| TTSSpeakFound[TTS: Speak<br/>'X elements found']
    TTSSpeakFound --> AIEnabled{AI Enabled?}
    
    AIEnabled -->|NO| HeuristicSelection[Heuristic Selection]
    HeuristicSelection --> ReturnElement1[Return Element]
    
    AIEnabled -->|YES| RandomSubset[Random Subset Selection<br/>- Shuffle array<br/>- Take first N<br/>maxElementsToShowAI]
    RandomSubset --> BuildContext[Build Page Context for AI<br/>- URL, Title<br/>- Headings<br/>- Elements<br/>- Visited URLs<br/>- Recent clicks]
    BuildContext --> DecisionMaker[DecisionMaker.recommendBestInteraction]
    DecisionMaker --> AIReceived{AI Recommendation<br/>Received?}
    
    AIReceived -->|NO| FallbackHeuristics[Fallback to Heuristics]
    FallbackHeuristics --> ReturnElement2[Return Element]
    
    AIReceived -->|YES| MapIndex[Map AI Index to Full Array<br/>AI only saw subset]
    MapIndex --> CheckGuardrails[Check Guardrails<br/>- Is 'home'?<br/>- Recently clicked?<br/>- Visited URL?]
    CheckGuardrails --> GuardrailResult{Result}
    
    GuardrailResult -->|ALLOWED| FindInArray[Find in Full Array]
    FindInArray --> ReturnElement3[Return Element]
    
    GuardrailResult -->|BLOCKED| FindAlternative[Find Alternative<br/>- Not blocked<br/>- Not 'home'<br/>- Not visited]
    FindAlternative --> AlternativeFound{Found?}
    
    AlternativeFound -->|YES| ReturnElement4[Return Element]
    AlternativeFound -->|NO| FallbackHeuristics2[Fallback to Heuristics]
    FallbackHeuristics2 --> ReturnElement5[Return Element]
    
    ReturnElement1 --> RecordInteraction[Record Interaction<br/>InteractionTracker]
    ReturnElement2 --> RecordInteraction
    ReturnElement3 --> RecordInteraction
    ReturnElement4 --> RecordInteraction
    ReturnElement5 --> RecordInteraction
    
    RecordInteraction --> TTSSpeakElement[TTS: Speak Element Name]
    TTSSpeakElement --> VerifyElement[Verify Element Exists]
    VerifyElement --> InteractionHandler[InteractionHandler.interactWithElement]
    InteractionHandler --> End([END])
    
    style Start fill:#90EE90
    style End fill:#FFB6C1
    style AIEnabled fill:#FFE4B5
    style AIReceived fill:#FFE4B5
    style GuardrailResult fill:#FFE4B5
    style AlternativeFound fill:#FFE4B5
    style ElementsFound fill:#FFE4B5
    style StillNone fill:#FFE4B5
```

## Detailed Decision Points

### 1. Element Detection (`ElementDetector.findInteractiveElements()`)

**Input:** Page object, base origin URL

**Process:**
1. Wait for page to be ready (`domcontentloaded`)
2. Wait for shadow DOM custom elements (if present)
3. Trigger lazy loading by scrolling
4. Wait for interactive elements to appear
5. Scan DOM (including shadow DOM traversal)
6. Filter elements:
   - **Exclude elements in ignored tags:** `<header>`, `<aside>`, `<footer>`, `dbs-top-bar` (configurable)
   - **Check visibility:** Must be visible (not `display: none`, `visibility: hidden`, opacity > 0)
   - **Check interactivity:** Must be clickable (buttons, links, inputs with proper roles)
   - **Exclude destructive actions:** Skip buttons with "delete" + "remove" in text

**Output:** Array of `InteractiveElement[]`

**Fallback:** If `page.evaluate()` fails, use Playwright's `locator` API

---

### 2. Random Subset Selection (AI Mode Only)

**When:** AI is enabled and elements are found

**Process:**
1. Shuffle the full array randomly: `[...elements].sort(() => Math.random() - 0.5)`
2. Take first N elements: `shuffled.slice(0, maxElementsToShowAI)`
   - Default: `maxElementsToShowAI = 10` (configurable in `config.yaml`)

**Why:** 
- Reduces AI processing time
- Provides variety across runs (randomization)
- Prevents AI from always seeing the same first elements

**Output:** Subset of elements to show to AI

---

### 3. AI Decision Making (`DecisionMaker.recommendBestInteraction()`)

**Input:** `PageContext` containing:
- URL, title, headings
- Subset of elements (with indices)
- Visited URLs
- Target navigations, current navigations
- Recent interaction keys (last 5 clicks)

**Process:**
1. Build prompt with context
2. Send to AI provider (OpenAI, Anthropic, or Ollama)
3. AI analyzes elements and returns:
   - `elementIndex` (relative to subset)
   - `reasoning` (why this element was chosen)

**Output:** `Recommendation | null`

**Fallback:** If AI fails or returns null → Use heuristics

---

### 4. Guardrails & Duplicate Avoidance

**When:** AI recommends an element

**Checks:**

1. **"Homey" Check:**
   - Element text contains "home" (case-insensitive)
   - OR element is a link to the initial URL

2. **Recent Interaction Check:**
   - Element key is in recent interaction history (last 10 clicks)
   - Interaction key = `{type}-{text}-{href}` (normalized)

3. **Visited URL Check:**
   - Element href (normalized) is in visited URLs set

**If Blocked:**
- Find alternative element that passes all checks
- If no alternative found → Fallback to heuristics

**If Allowed:**
- Map AI index back to full array
- Find element in full array by:
  1. Matching href (for links) - most reliable
  2. Matching text (case-insensitive)
  3. Matching selector (fallback)

---

### 5. Heuristic Selection (`HeuristicSelector.selectBestElement()`)

**When:** 
- AI is disabled
- AI fails or returns null
- AI recommendation is blocked and no alternative found

**Priority Order:**

1. **Unvisited Navigation Links:**
   - Find links that navigate to unvisited pages
   - Skip: JavaScript links, hash-only links, empty links
   - Prefer: Links with meaningful text (1-50 chars)
   - Prefer: Links that navigate (not just hash anchors)

2. **Action Buttons:**
   - Find buttons with action words: `submit`, `search`, `login`, `next`, `continue`, `go`, `view`, `see`, `explore`, `browse`, `shop`, `add`, `create`, `start`, `begin`, `apply`

3. **Random Selection:**
   - If no unvisited links or action buttons found
   - Select random element from available elements

---

### 6. Interaction Recording

**After Selection:**

1. **Record Interaction:**
   - `InteractionTracker.rememberInteraction(element, historySize)`
   - Stores interaction key in recent history
   - Default history size: 20 (configurable)

2. **Log Selection:**
   - Current URL
   - Number of available elements
   - Selected element type and text
   - Selection method (AI, heuristic, etc.)

3. **TTS Announcement:**
   - Speak element name with dynamic prefix (if TTS enabled)

---

### 7. Element Interaction

**Before Click:**
- Verify element exists: `InteractionHandler.verifyElementExists()`

**Interaction:**
- Click buttons/links: `element.click()`
- Fill inputs: `element.fill(value)`
- Handle navigation: Wait for URL change or network idle

**Error Handling:**
- If click fails → Return `false`
- Planner will retry or try different element

---

## Configuration Options

All decision points can be configured in `config.yaml`:

```yaml
planner:
  maxElementsToShowAI: 10        # Number of elements to show AI
  ignoredTags:                   # Tags to ignore during detection
    - header
    - aside
    - footer
    - dbs-top-bar
    # Note: 'nav' was removed to allow navigation menu interactions
  recentInteractionHistorySize: 20 # How many recent clicks to remember
```

## Code References

- **Element Detection:** `src/planner/elements/ElementDetector.ts`
- **Element Selection:** `src/planner/utils/ElementSelector.ts`
- **AI Decision Making:** `src/ai/DecisionMaker.ts`
- **Heuristic Selection:** `src/ai/HeuristicSelector.ts`
- **Interaction Tracking:** `src/planner/utils/InteractionTracker.ts`
- **Interaction Handling:** `src/planner/interactions/InteractionHandler.ts`

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Planner
    participant CookieHandler
    participant ElementDetector
    participant ElementSelector
    participant DecisionMaker
    participant AIProvider
    participant HeuristicSelector
    participant InteractionTracker
    participant TTS
    participant InteractionHandler
    
    Planner->>CookieHandler: handleCookiePopup()
    CookieHandler-->>Planner: Cookie handled
    
    Planner->>ElementDetector: findInteractiveElements()
    activate ElementDetector
    ElementDetector->>ElementDetector: Wait for page ready
    ElementDetector->>ElementDetector: Wait for shadow DOM
    ElementDetector->>ElementDetector: Scan DOM (including shadow DOM)
    ElementDetector->>ElementDetector: Filter by ignored tags
    ElementDetector->>ElementDetector: Filter by visibility
    ElementDetector-->>Planner: InteractiveElement[]
    deactivate ElementDetector
    
    Planner->>ElementSelector: selectElement()
    activate ElementSelector
    
    alt AI enabled
        ElementSelector->>ElementSelector: Shuffle & subset elements
        ElementSelector->>ElementSelector: Build PageContext
        ElementSelector->>DecisionMaker: recommendBestInteraction()
        activate DecisionMaker
        DecisionMaker->>AIProvider: AI API call
        activate AIProvider
        AIProvider-->>DecisionMaker: Recommendation
        deactivate AIProvider
        DecisionMaker-->>ElementSelector: Recommendation
        deactivate DecisionMaker
        
        ElementSelector->>ElementSelector: Check guardrails (home, recent, visited)
        
        alt Blocked
            ElementSelector->>ElementSelector: Find alternative OR fallback to heuristics
        end
        
        ElementSelector->>ElementSelector: Map AI index to full array
    else AI disabled or failed
        ElementSelector->>HeuristicSelector: selectBestElement()
        activate HeuristicSelector
        HeuristicSelector->>HeuristicSelector: Find unvisited link
        HeuristicSelector->>HeuristicSelector: Find action button
        HeuristicSelector->>HeuristicSelector: Random selection
        HeuristicSelector-->>ElementSelector: Selected element
        deactivate HeuristicSelector
    end
    
    ElementSelector-->>Planner: Selected element
    deactivate ElementSelector
    
    Planner->>InteractionTracker: rememberInteraction()
    InteractionTracker-->>Planner: Interaction recorded
    
    opt TTS enabled
        Planner->>TTS: speakAction()
        TTS-->>Planner: Spoken
    end
    
    Planner->>InteractionHandler: interactWithElement()
    activate InteractionHandler
    InteractionHandler->>InteractionHandler: Verify element exists
    InteractionHandler->>InteractionHandler: Click/fill element
    InteractionHandler-->>Planner: Interaction complete
    deactivate InteractionHandler
```

## Key Design Decisions

1. **Random Subset for AI:**
   - Prevents AI from always seeing the same elements
   - Reduces processing time
   - Maintains variety across runs

2. **Guardrails:**
   - Prevents infinite loops (clicking "home" repeatedly)
   - Avoids duplicate interactions
   - Ensures exploration of new pages

3. **Graceful Degradation:**
   - AI → Heuristics → Random
   - Always finds an element if available
   - Never gets stuck

4. **Interaction Tracking:**
   - Short-term memory (last 10-20 clicks)
   - Prevents immediate repetition
   - Allows revisiting after exploration

5. **Shadow DOM Support:**
   - Recursive traversal of shadow roots
   - Handles modern web components
   - Fallback to Playwright locators if needed


/**
 * Default system prompts for AI components
 * These are the prompts defined in the codebase
 */

export const DEFAULT_PROMPTS = {
  planner: `Select the best element to click for test coverage.

Page: {title} ({url})
Goal: {currentNavigations}/{targetNavigations} pages explored
Avoid: {recentInteractions}
Elements:
{elements}

Priority: 1) Links to NEW pages 2) Investment/product links 3) Main content links
Avoid: Sidebar/nav menus, repeated clicks, already visited URLs

Respond ONLY with JSON:
{"elementIndex": <0-{maxIndex}>, "reasoning": "<brief>"}`,

  generator: `Generate a Playwright test file for the following test scenario.

Test Scenario:
Title: {title}
Base URL: {baseUrl}
Spec Path: {specPath}
{seedPath}

Steps:
{steps}

Expected Results:
{expectedResults}

Requirements:
1. Use Playwright's test framework with \`test\` and \`expect\` from '@playwright/test'
2. Use the \`browser\` fixture and create a new context with cookie setup
3. Set cookiesOptin=true cookie via addInitScript before any page loads
4. For navigation: use \`waitUntil: 'domcontentloaded', timeout: 30000\` and then \`waitForLoadState('networkidle')\`
5. For clicks: use \`getByRole\` with proper selectors, add visibility checks with \`expect().toBeVisible()\`
6. For assertions: use \`toHaveTitle\` for page titles, \`toBeVisible\` for elements
7. Escape single quotes in strings (use \\' or double quotes)
8. Use unique variable names (link, link2, link3, etc.) to avoid redeclaration
9. Add appropriate wait times after actions
10. Close the context at the end

Generate ONLY the test code, no explanations. Start with the comment lines (// spec: and // seed: if applicable), then imports, then the test function.

Test code:`,

  healer: `You are a Playwright test healing expert. Fix the broken test code below.

Test Name: {testName}
Error: {errorMessage}
Line: {lineNumber}

Test Code:
\`\`\`typescript
{testContent}
\`\`\`

{problematicLine}
{contextCode}

Your task:
1. Analyze the error and identify the root cause
2. Fix the test code to resolve the error
3. Choose the BEST selector strategy that:
   - Is specific enough to avoid strict mode violations
   - Provides good test coverage
   - Is maintainable and readable
   - Matches the test's intent
4. Ensure the fixed code follows Playwright best practices:
   - Use getByRole with specific names when possible
   - Use .first() or .nth() only when necessary
   - Add proper wait conditions
   - Use appropriate timeouts
   - Maintain test readability

Priority for selector selection:
1. getByRole with specific, meaningful text/name
2. getByLabel for form inputs
3. getByPlaceholder for inputs without labels
4. getByTestId if test IDs are available
5. locator with specific CSS selectors as last resort

Return ONLY the complete fixed test code, no explanations. The code must be valid TypeScript and complete.

Fixed test code:`,

  tts: {
    prefix: `Generate {personalityDescription} for a playful AI assistant exploring a website. Context: "{context}".

Respond with ONLY the prefix text, nothing else. No quotes, no explanation, just the prefix.`,
    thinking: `Generate a short, playful phrase (5-8 words) for an AI assistant thinking about which of {elementCount} elements to click on a webpage. Be spontaneous and curious. Respond with ONLY the phrase, no quotes, no explanation.`,
    personalityDescriptions: {
      thinking: 'a short, playful phrase (5-8 words)',
      realizing: 'a short, playful exclamation or reaction (1-2 words, like "Oh!", "Hmm,", "Interesting,")',
      deciding: 'a short, spontaneous thinking phrase (2-4 words, like "Let me try", "Maybe", "I think")',
      acting: 'a short action verb (1 word, like "Clicking", "Going", "Trying", "Selecting")',
    },
  },
};


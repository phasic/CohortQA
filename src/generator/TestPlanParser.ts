import { readFileSync } from 'fs';
import { join } from 'path';
import { ParsedTestPlan, ParsedTestStep } from './types.js';

export class TestPlanParser {
  /**
   * Parses the test plan markdown file
   */
  parseTestPlan(filePath?: string): ParsedTestPlan {
    const testPlanPath = filePath || join(process.cwd(), 'test-plan', 'test-plan.md');
    const content = readFileSync(testPlanPath, 'utf-8');
    
    // Extract start URL
    const startUrlMatch = content.match(/\*\*Start URL\*\*:\s*(.+)/);
    const startUrl = startUrlMatch ? startUrlMatch[1].trim() : '';
    
    if (!startUrl) {
      throw new Error('Could not find Start URL in test plan');
    }
    
    // Parse steps
    const steps: ParsedTestStep[] = [];
    const stepSections = content.split(/^### Step \d+:/m);
    
    // Skip the first section (header/metadata)
    for (let i = 1; i < stepSections.length; i++) {
      const stepSection = stepSections[i];
      const step = this.parseStep(stepSection, i);
      if (step) {
        steps.push(step);
      }
    }
    
    return {
      startUrl,
      steps,
    };
  }
  
  /**
   * Parses a single step section
   */
  private parseStep(stepSection: string, stepNumber: number): ParsedTestStep | null {
    const lines = stepSection.split('\n');
    
    // Extract action type
    const actionMatch = stepSection.match(/\*\*Action:\*\*\s*(click|type|select|hover|scroll|navigate)/i);
    const action = actionMatch ? (actionMatch[1].toLowerCase() as ParsedTestStep['action']) : 'click';
    
    // Extract element information
    const element: ParsedTestStep['element'] = {};
    
    const selectorMatch = stepSection.match(/- \*\*Selector\*\*:\s*`([^`]+)`/);
    if (selectorMatch) {
      element.selector = selectorMatch[1];
    }
    
    const textMatch = stepSection.match(/- \*\*Text\*\*:\s*"([^"]+)"/);
    if (textMatch) {
      element.text = textMatch[1];
    }
    
    const linkMatch = stepSection.match(/- \*\*Link\*\*:\s*(.+)/);
    if (linkMatch) {
      element.href = linkMatch[1].trim();
    }
    
    const idMatch = stepSection.match(/- \*\*ID\*\*:\s*(.+)/);
    if (idMatch) {
      element.id = idMatch[1].trim();
    }
    
    const xpathMatch = stepSection.match(/- \*\*XPath\*\*:\s*`([^`]+)`/);
    if (xpathMatch) {
      element.xpath = xpathMatch[1];
    }
    
    const ariaLabelMatch = stepSection.match(/- \*\*Aria Label\*\*:\s*"([^"]+)"/);
    if (ariaLabelMatch) {
      element.ariaLabel = ariaLabelMatch[1];
    }
    
    const roleMatch = stepSection.match(/- \*\*Role\*\*:\s*(.+)/);
    if (roleMatch) {
      element.role = roleMatch[1].trim();
    }
    
    // Extract expected results
    const expectedResults: ParsedTestStep['expectedResults'] = {};
    
    const urlMatch = stepSection.match(/- \*\*URL\*\*:\s*(.+)/);
    if (urlMatch) {
      expectedResults.url = urlMatch[1].trim();
    }
    
    const titleMatch = stepSection.match(/- \*\*Page Title\*\*:\s*"([^"]+)"/);
    if (titleMatch) {
      expectedResults.pageTitle = titleMatch[1];
    }
    
    // Extract notable elements
    const notableElements: ParsedTestStep['expectedResults']['notableElements'] = [];
    const notableElementsMatch = stepSection.match(/- \*\*Notable Elements\*\*:\s*\n((?:  - .+\n?)+)/);
    if (notableElementsMatch) {
      const notableElementsText = notableElementsMatch[1];
      const notableElementLines = notableElementsText.match(/  - (.+)/g) || [];
      
      notableElementLines.forEach(line => {
        const cleanLine = line.replace(/^  - /, '').trim();
        
        // Parse format: `selector` "text" - reason
        // Or: #id "text" - reason
        // Or: <tag> "text" - reason
        const selectorMatch = cleanLine.match(/`([^`]+)`/);
        const idMatch = cleanLine.match(/#([^\s"`]+)/);
        const tagMatch = cleanLine.match(/<(\w+)>/);
        const textMatch = cleanLine.match(/"([^"]+)"/);
        const reasonMatch = cleanLine.match(/- (.+)$/);
        
        const notableElement: NonNullable<ParsedTestStep['expectedResults']['notableElements']>[0] = {};
        
        // Check if selector is actually an ID selector (starts with #)
        if (selectorMatch && selectorMatch[1].startsWith('#')) {
          // Extract ID from selector (remove the #)
          notableElement.id = selectorMatch[1].substring(1);
        } else if (idMatch) {
          // Direct ID match (e.g., #id in text)
          notableElement.id = idMatch[1];
        } else if (selectorMatch) {
          notableElement.selector = selectorMatch[1];
        } else if (tagMatch) {
          notableElement.tag = tagMatch[1];
        }
        
        if (textMatch) {
          notableElement.text = textMatch[1];
        }
        
        if (reasonMatch) {
          notableElement.reason = reasonMatch[1].trim();
        }
        
        if (notableElement.selector || notableElement.id || notableElement.tag) {
          notableElements.push(notableElement);
        }
      });
    }
    
    if (notableElements.length > 0) {
      expectedResults.notableElements = notableElements;
    }
    
    // Extract key elements (headings)
    const keyElements: ParsedTestStep['expectedResults']['keyElements'] = [];
    const keyElementsMatch = stepSection.match(/- \*\*Key Elements\*\*:\s*\n((?:  - .+\n?)+)/);
    if (keyElementsMatch) {
      const keyElementsText = keyElementsMatch[1];
      const keyElementLines = keyElementsText.match(/  - (.+)/g) || [];
      
      keyElementLines.forEach(line => {
        const cleanLine = line.replace(/^  - /, '').trim();
        const tagMatch = cleanLine.match(/<(\w+)>/);
        const textMatch = cleanLine.match(/"([^"]+)"/);
        const idMatch = cleanLine.match(/#([^\s"`]+)/);
        const selectorMatch = cleanLine.match(/`([^`]+)`/);
        
        const keyElement: NonNullable<ParsedTestStep['expectedResults']['keyElements']>[0] = {};
        
        if (tagMatch) {
          keyElement.tag = tagMatch[1];
        }
        if (textMatch) {
          keyElement.text = textMatch[1];
        }
        if (idMatch) {
          keyElement.id = idMatch[1];
        }
        if (selectorMatch) {
          keyElement.selector = selectorMatch[1];
        }
        
        if (keyElement.tag || keyElement.text || keyElement.id || keyElement.selector) {
          keyElements.push(keyElement);
        }
      });
    }
    
    if (keyElements.length > 0) {
      expectedResults.keyElements = keyElements;
    }
    
    // Determine if navigation occurred
    const navigated = expectedResults.url !== undefined && expectedResults.url !== '';
    
    return {
      stepNumber,
      action,
      element: Object.keys(element).length > 0 ? element : undefined,
      urlAfter: expectedResults.url || '',
      navigated,
      expectedResults,
    };
  }
}


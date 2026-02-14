/**
 * Types for the generator component
 */

export interface ParsedTestPlan {
  startUrl: string;
  steps: ParsedTestStep[];
}

export interface ParsedTestStep {
  stepNumber: number;
  action: 'click' | 'type' | 'select' | 'hover' | 'scroll' | 'navigate';
  element?: {
    selector?: string;
    text?: string;
    href?: string;
    id?: string;
    xpath?: string;
    ariaLabel?: string;
    role?: string;
    tag?: string;
    isInShadowDOM?: boolean;
  };
  urlBefore?: string;
  urlAfter: string;
  navigated: boolean;
  value?: string;
  waitAfter?: number;
  expectedResults: {
    url?: string;
    pageTitle?: string;
    keyElements?: Array<{
      tag?: string;
      text?: string;
      id?: string;
      selector?: string;
    }>;
    notableElements?: Array<{
      selector?: string;
      text?: string;
      tag?: string;
      id?: string;
      reason?: string;
    }>;
  };
}


export interface Config {
  start_url?: string;
  stay_on_path?: string | null;
  browser: {
    headless: boolean;
    timeout: number;
    cookies?: Array<{
      name: string;
      value: string;
      domain?: string;
      path?: string;
      secure?: boolean;
      sameSite?: 'Strict' | 'Lax' | 'None';
      httpOnly?: boolean;
    }>;
  };
  navigation: {
    max_navigations: number;
    max_loops: number;
    wait_after_navigation: number;
    stay_on_domain: boolean;
  };
  element_extraction: {
    interactable_elements: string[];
    blacklist_tags: string[];
    include_invisible: boolean;
    max_elements: number;
    notable_elements?: string[]; // Selectors for elements to identify as notable (e.g., ['h1', 'h2', 'button', 'input'])
    enable_notable_elements?: boolean; // Enable/disable notable elements identification (default: true)
  };
  ai: {
    provider: string;
    model: string;
    base_url: string;
    temperature: number;
    max_tokens: number;
    max_elements_in_prompt?: number;
    prompt: {
      system_message: string;
      instructions: string;
    };
  };
  interaction: {
    delay_before: number;
    delay_after: number;
    wait_timeout: number;
  };
}

export interface InteractableElement {
  index: number;
  tag: string;
  type?: string; // for input elements
  text?: string;
  selector: string;
  href?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
  role?: string;
  isVisible: boolean;
  shadowDOM?: boolean; // True if element is in a shadow DOM
  elementIdentifier?: { // Used to find element in shadow DOM
    tag: string;
    text?: string;
    href?: string;
    id?: string;
    className?: string;
    ariaLabel?: string;
    role?: string;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AIResponse {
  elementIndex: number;
  action: 'click' | 'type' | 'select' | 'hover' | 'scroll';
  value?: string;
  reasoning: string;
}

/**
 * Test Plan structure for generator consumption
 */
export interface TestPlan {
  metadata: {
    startUrl: string;
  };
  steps: TestStep[];
}

export interface TestStep {
  stepNumber: number;
  action: 'click' | 'type' | 'select' | 'hover' | 'scroll' | 'navigate';
  element?: {
    tag: string;
    selector?: string;
    text?: string;
    href?: string;
    id?: string;
    xpath?: string;
    ariaLabel?: string;
    role?: string;
    isInShadowDOM?: boolean;
  };
  urlBefore: string;
  urlAfter: string;
  navigated: boolean;
  value?: string; // For type/select actions
  waitAfter?: number; // Milliseconds to wait after action
  timestamp: string;
  // Expected results after navigation
  pageTitle?: string;
  keyElements?: Array<{
    selector?: string;
    text?: string;
    tag?: string;
    id?: string;
  }>;
  notableElements?: Array<{
    selector?: string;
    text?: string;
    tag?: string;
    id?: string;
    reason?: string;
  }>;
}


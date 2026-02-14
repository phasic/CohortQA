export interface Config {
  browser: {
    headless: boolean;
    timeout: number;
  };
  navigation: {
    max_navigations: number;
    wait_after_navigation: number;
  };
  element_extraction: {
    include_selectors: string[];
    include_invisible: boolean;
    max_elements: number;
  };
  ai: {
    provider: string;
    model: string;
    base_url: string;
    temperature: number;
    max_tokens: number;
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


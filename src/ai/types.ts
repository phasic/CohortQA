export interface InteractiveElement {
  type: string;
  text: string;
  href?: string;
  selector: string;
  isLink: boolean;
  tagName: string;
  index?: number;
  shadowPath?: string;
}

export interface PageContext {
  url: string;
  title: string;
  headings: string[];
  elements: InteractiveElement[];
  visitedUrls: string[];
  targetNavigations: number;
  currentNavigations: number;
  /**
   * A short history of recently chosen interactions (keys), so the AI can avoid repeating itself.
   * The planner uses this as a "don't pick these again" memory.
   */
  recentInteractionKeys?: string[];
}

export interface AIRecommendation {
  elementIndex: number;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  expectedOutcome: string;
  roast?: string; // Optional sassy roast of other elements
}

export type AIProvider = 'openai' | 'anthropic' | 'ollama';


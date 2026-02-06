export interface TestPlan {
  title: string;
  overview: string;
  scenarios: TestScenario[];
}

export interface TestScenario {
  title: string;
  seed?: string;
  steps: string[];
  expectedResults: string[];
}

export interface PageInfo {
  title: string;
  url: string;
  buttons: Array<{ text: string; selector: string }>;
  inputs: Array<{ type: string; placeholder: string; name: string; selector: string }>;
  links: Array<{ text: string; href: string; selector: string }>;
  forms: Array<{ action: string; method: string; inputs: number }>;
  headings: string[];
}


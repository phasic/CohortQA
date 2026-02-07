/**
 * Types for the Healer module
 */

export interface TestFailure {
  testName: string;
  error: string;
  file: string;
  line?: number;
}

export interface TestResult {
  passed: boolean;
  failures: TestFailure[];
}

export interface HealResult {
  healed: boolean;
  reason?: string;
}

export interface FixResult {
  fixed: string;
  appliedFixes: string[];
}


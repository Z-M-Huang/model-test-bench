// ---------------------------------------------------------------------------
// Scenario Types
// ---------------------------------------------------------------------------

import type { ScoringDimension } from './provider.js';

/** Built-in category labels for scenarios (behavior/planning focused). */
export type ScenarioCategory =
  | 'planning'
  | 'instruction-following'
  | 'reasoning'
  | 'tool-strategy'
  | 'error-handling'
  | 'ambiguity-handling'
  | 'scope-management'
  | 'custom';

/** A scenario defines what to test and how to grade. */
export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly category: ScenarioCategory;
  // Task
  readonly prompt: string;
  readonly systemPrompt: string;
  // Tool configuration
  readonly enabledTools: readonly string[];
  // Grading
  readonly expectedAnswer: string;
  readonly criticalRequirements: readonly string[];
  readonly gradingGuidelines: string;
  readonly scoringDimensions: readonly ScoringDimension[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

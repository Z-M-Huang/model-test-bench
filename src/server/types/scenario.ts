// ---------------------------------------------------------------------------
// Scenario Types
// ---------------------------------------------------------------------------

import type { ScoringDimension } from './setup.js';

/** Built-in category labels for scenarios. */
export type ScenarioCategory =
  | 'coding'
  | 'debugging'
  | 'refactoring'
  | 'testing'
  | 'documentation'
  | 'architecture'
  | 'devops'
  | 'data'
  | 'security'
  | 'custom';

/** A file that should exist in the workspace before the scenario runs. */
export interface WorkspaceFile {
  readonly path: string;
  readonly content: string;
}

/** A scenario defines a prompt and its expected outcomes. */
export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly category: ScenarioCategory;
  readonly builtIn: boolean;
  readonly prompt: string;
  readonly workspaceFiles: readonly WorkspaceFile[];
  readonly expectedAnswer: string;
  readonly criticalRequirements: readonly string[];
  readonly gradingGuidelines: string;
  readonly scoringDimensions: readonly ScoringDimension[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

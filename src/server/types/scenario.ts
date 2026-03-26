// ---------------------------------------------------------------------------
// Scenario Types
// ---------------------------------------------------------------------------

import type {
  ClaudeMdEntry,
  McpServerEntry,
  PermissionMode,
  RuleEntry,
  ScoringDimension,
  SkillEntry,
  SubagentEntry,
} from './provider.js';

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

/** A file that should exist in the workspace before the scenario runs. */
export interface WorkspaceFile {
  readonly path: string;
  readonly content: string;
}

/** A scenario defines what to test, agent config, and how to grade. */
export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly category: ScenarioCategory;
  // Agent configuration
  readonly claudeMdFiles: readonly ClaudeMdEntry[];
  readonly rules: readonly RuleEntry[];
  readonly skills: readonly SkillEntry[];
  readonly subagents: readonly SubagentEntry[];
  readonly mcpServers: readonly McpServerEntry[];
  readonly permissionMode: PermissionMode;
  readonly maxTurns?: number;
  readonly allowedTools?: readonly string[];
  readonly disallowedTools?: readonly string[];
  // Test content
  readonly prompt: string;
  readonly workspaceFiles: readonly WorkspaceFile[];
  // Grading
  readonly expectedAnswer: string;
  readonly criticalRequirements: readonly string[];
  readonly gradingGuidelines: string;
  readonly scoringDimensions: readonly ScoringDimension[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

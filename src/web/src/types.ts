// ---------------------------------------------------------------------------
// Frontend type definitions — mirrors server types needed for rendering.
// Do NOT import from server (different build target).
// ---------------------------------------------------------------------------

// -- Provider ----------------------------------------------------------------

export interface ApiProviderConfig {
  readonly kind: 'api';
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
}

export interface OAuthProviderConfig {
  readonly kind: 'oauth';
  readonly oauthToken: string;
  readonly model: string;
}

export type ProviderConfig = ApiProviderConfig | OAuthProviderConfig;

// -- Scoring -----------------------------------------------------------------

export interface ScoringDimension {
  readonly name: string;
  readonly weight: number;
  readonly description: string;
}

// -- Setup -------------------------------------------------------------------

export interface TestSetup {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly provider: ProviderConfig;
  readonly thinking?: { kind: string; budgetTokens?: number };
  readonly effort?: 'none' | 'low' | 'medium' | 'high';
  readonly timeoutSeconds: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// -- Scenario ----------------------------------------------------------------

export type ScenarioCategory =
  | 'planning'
  | 'instruction-following'
  | 'reasoning'
  | 'tool-strategy'
  | 'error-handling'
  | 'ambiguity-handling'
  | 'scope-management'
  | 'custom';

export interface WorkspaceFile {
  readonly path: string;
  readonly content: string;
}

export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly category: ScenarioCategory;
  // Agent configuration
  readonly claudeMdFiles: readonly { role: 'project' | 'user'; content: string }[];
  readonly rules: readonly { name: string; content: string }[];
  readonly skills: readonly { name: string; content: string }[];
  readonly subagents: readonly { name: string; description: string; prompt: string }[];
  readonly mcpServers: readonly { name: string; config: Record<string, unknown> }[];
  readonly permissionMode: string;
  readonly maxTurns?: number;
  readonly allowedTools?: readonly string[];
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

// -- Run ---------------------------------------------------------------------

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SDKMessageRecord {
  readonly timestamp: string;
  readonly message: Record<string, unknown>;
}

export interface Run {
  readonly id: string;
  readonly setupId: string;
  readonly scenarioId: string;
  readonly status: RunStatus;
  readonly setupSnapshot: TestSetup;
  readonly scenarioSnapshot: Scenario;
  readonly messages: readonly SDKMessageRecord[];
  readonly resultText: string;
  readonly totalCostUsd: number;
  readonly durationMs: number;
  readonly numTurns: number;
  readonly error?: string;
  readonly reviewerSetupIds?: readonly string[];
  readonly reviewerSetupSnapshots?: readonly TestSetup[];
  readonly maxEvalRounds?: number;
  readonly evaluationId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// -- Evaluation --------------------------------------------------------------

export type EvaluationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface EvaluatorConfig {
  readonly provider: ProviderConfig;
  readonly role: string;
}

export interface EvaluationRequest {
  readonly runId: string;
  readonly evaluators: readonly EvaluatorConfig[];
  readonly maxRounds: number;
  readonly maxBudgetUsd?: number;
}

export interface AnswerComparison {
  readonly matches: boolean;
  readonly explanation: string;
  readonly similarity: number;
}

export interface CriticalPartResult {
  readonly requirement: string;
  readonly met: boolean;
  readonly evidence: string;
}

export interface IndividualEvaluation {
  readonly evaluatorRole: string;
  readonly dimension: string;
  readonly score: number;
  readonly reasoning: string;
}

export interface InstructionCompliance {
  readonly followed: readonly string[];
  readonly violated: readonly string[];
  readonly notApplicable: readonly string[];
  readonly overallCompliance: number;
}

export interface SetupComplianceReport {
  readonly instructionCompliance: InstructionCompliance;
  readonly skillUsage: readonly { skillName: string; invoked: boolean; invocationCount: number }[];
  readonly subagentUsage: readonly { subagentName: string; invoked: boolean; invocationCount: number }[];
}

export interface EvaluationSynthesis {
  readonly dimensionScores: Record<string, number>;
  readonly weightedTotal: number;
  readonly confidence: number;
  readonly dissenting: readonly string[];
}

export interface Evaluation {
  readonly id: string;
  readonly runId: string;
  readonly status: EvaluationStatus;
  readonly evaluators: readonly EvaluatorConfig[];
  readonly rounds: readonly {
    roundNumber: number;
    evaluations: readonly IndividualEvaluation[];
    consensusReached: boolean;
    timestamp: string;
  }[];
  readonly answerComparison: AnswerComparison;
  readonly criticalResults: readonly CriticalPartResult[];
  readonly setupCompliance: SetupComplianceReport;
  readonly synthesis: EvaluationSynthesis;
  readonly totalCostUsd: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

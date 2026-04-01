// ---------------------------------------------------------------------------
// Frontend type definitions — mirrors server types needed for rendering.
// Do NOT import from server (different build target).
// ---------------------------------------------------------------------------

// -- Scoring -----------------------------------------------------------------

export interface ScoringDimension {
  readonly name: string;
  readonly weight: number;
  readonly description: string;
}

// -- Provider ----------------------------------------------------------------

export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly providerName: string;
  readonly model: string;
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
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

export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly category: ScenarioCategory;
  readonly prompt: string;
  readonly systemPrompt: string;
  readonly enabledTools: readonly string[];
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
  readonly providerId: string;
  readonly scenarioId: string;
  readonly status: RunStatus;
  readonly providerSnapshot: Provider;
  readonly scenarioSnapshot: Scenario;
  readonly messages: readonly SDKMessageRecord[];
  readonly resultText: string;
  readonly totalCostUsd: number;
  readonly durationMs: number;
  readonly numTurns: number;
  readonly error?: string;
  readonly reviewerProviderIds?: readonly string[];
  readonly reviewerProviderSnapshots?: readonly Provider[];
  readonly maxEvalRounds?: number;
  readonly evaluationId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// -- Evaluation --------------------------------------------------------------

export type EvaluationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface EvaluatorConfig {
  readonly providerName: string;
  readonly model: string;
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly role: string;
}

export interface EvaluationRequest {
  readonly runId: string;
  readonly evaluators: readonly EvaluatorConfig[];
  readonly maxRounds: number;
  readonly maxBudgetUsd?: number;
}

/** Body sent to POST /api/evaluations (providerId-based, keys resolved server-side). */
export interface CreateEvaluationBody {
  readonly runId: string;
  readonly evaluators: readonly { providerId: string; role: string }[];
  readonly maxRounds: number;
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

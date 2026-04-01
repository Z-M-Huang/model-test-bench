// ---------------------------------------------------------------------------
// Evaluation Types
// ---------------------------------------------------------------------------

/** Configuration for an evaluator agent. */
export interface EvaluatorConfig {
  readonly providerName: string;
  readonly model: string;
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly role: string;
}

/** Request to start an evaluation pipeline. */
export interface EvaluationRequest {
  readonly runId: string;
  readonly evaluators: readonly EvaluatorConfig[];
  readonly maxRounds: number;
  readonly maxBudgetUsd?: number;
}

/** Lifecycle status of an evaluation. */
export type EvaluationStatus = 'pending' | 'running' | 'completed' | 'failed';

/** How well the answer matches the expected answer. */
export interface AnswerComparison {
  readonly matches: boolean;
  readonly explanation: string;
  readonly similarity: number; // 0-1
}

/** Result for a single critical requirement. */
export interface CriticalPartResult {
  readonly requirement: string;
  readonly met: boolean;
  readonly evidence: string;
}

/** Per-dimension score from one evaluator. */
export interface IndividualEvaluation {
  readonly evaluatorRole: string;
  readonly dimension: string;
  readonly score: number; // 0-10
  readonly reasoning: string;
}

/** Did the agent follow the instructions in its system prompt? */
export interface InstructionCompliance {
  readonly followed: readonly string[];
  readonly violated: readonly string[];
  readonly notApplicable: readonly string[];
  readonly overallCompliance: number; // 0-1
}

/** Aggregated report on instruction compliance. */
export interface SetupComplianceReport {
  readonly instructionCompliance: InstructionCompliance;
}

/** Ledger tracking cost/usage per evaluator. */
export interface EvaluatorLedger {
  readonly evaluatorRole: string;
  readonly totalCostUsd: number;
  readonly totalTokensIn: number;
  readonly totalTokensOut: number;
  readonly roundsParticipated: number;
}

/** A single round of evaluation (there may be multiple rounds for consensus). */
export interface EvaluationRound {
  readonly roundNumber: number;
  readonly evaluations: readonly IndividualEvaluation[];
  readonly consensusReached: boolean;
  readonly timestamp: string;
}

/** Synthesised final scores across evaluators and rounds. */
export interface EvaluationSynthesis {
  readonly dimensionScores: Readonly<Record<string, number>>;
  readonly weightedTotal: number;
  readonly confidence: number; // 0-1
  readonly dissenting: readonly string[];
}

/** Overall report on how effective a setup is across evaluations. */
export interface SetupEffectivenessReport {
  readonly setupId: string;
  readonly averageScore: number;
  readonly scenarioBreakdown: Readonly<Record<string, number>>;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
}

/** The full evaluation record persisted after the pipeline completes. */
export interface Evaluation {
  readonly id: string;
  readonly runId: string;
  readonly status: EvaluationStatus;
  readonly evaluators: readonly EvaluatorConfig[];
  readonly rounds: readonly EvaluationRound[];
  readonly answerComparison: AnswerComparison;
  readonly criticalResults: readonly CriticalPartResult[];
  readonly setupCompliance: SetupComplianceReport;
  readonly synthesis: EvaluationSynthesis;
  readonly ledger: readonly EvaluatorLedger[];
  readonly totalCostUsd: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

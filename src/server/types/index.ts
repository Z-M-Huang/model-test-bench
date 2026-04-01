// ---------------------------------------------------------------------------
// Central re-export for all shared types
// ---------------------------------------------------------------------------

export type {
  Provider,
  ScoringDimension,
} from './provider.js';

export type { Scenario, ScenarioCategory } from './scenario.js';

export type { Run, RunStatus, SDKMessageRecord } from './run.js';

export type {
  AnswerComparison,
  CriticalPartResult,
  Evaluation,
  EvaluationRequest,
  EvaluationRound,
  EvaluationStatus,
  EvaluationSynthesis,
  EvaluatorConfig,
  EvaluatorLedger,
  IndividualEvaluation,
  InstructionCompliance,
  SetupComplianceReport,
  SetupEffectivenessReport,
} from './evaluation.js';

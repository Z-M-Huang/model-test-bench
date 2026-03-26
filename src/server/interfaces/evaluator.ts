import type {
  Provider,
  Scenario,
  Run,
  Evaluation,
  EvaluationRequest,
  EvaluationStatus,
  SDKMessageRecord,
} from '../types/index.js';

export interface EvalMessageInfo {
  readonly phase: 'score' | 'compliance' | 'debate' | 'synthesis';
  readonly evaluatorRole: string;
  readonly roundNumber: number;
}

export interface EvaluationCallbacks {
  onStatusChange(status: EvaluationStatus): void;
  onProgress(step: string, detail?: string): void;
  onMessage(info: EvalMessageInfo, message: SDKMessageRecord): void;
}

export interface IEvaluator {
  evaluateRun(
    run: Run,
    scenario: Scenario,
    provider: Provider,
    request: EvaluationRequest,
    callbacks: EvaluationCallbacks,
  ): Promise<Evaluation>;
}

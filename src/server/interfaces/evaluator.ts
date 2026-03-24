import type {
  TestSetup,
  Scenario,
  Run,
  Evaluation,
  EvaluationRequest,
  EvaluationStatus,
} from '../types/index.js';

export interface EvaluationCallbacks {
  onStatusChange(status: EvaluationStatus): void;
}

export interface IEvaluator {
  evaluateRun(
    run: Run,
    scenario: Scenario,
    setup: TestSetup,
    request: EvaluationRequest,
    callbacks: EvaluationCallbacks,
  ): Promise<Evaluation>;
}

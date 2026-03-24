import type {
  TestSetup,
  Scenario,
  ScenarioCategory,
  Run,
  RunStatus,
  Evaluation,
  EvaluationStatus,
} from '../types/index.js';

export interface SetupFilter {
  readonly provider?: 'api' | 'oauth';
  readonly model?: string;
}

export interface ScenarioFilter {
  readonly category?: ScenarioCategory;
  readonly builtIn?: boolean;
  readonly tags?: readonly string[];
}

export interface RunFilter {
  readonly setupId?: string;
  readonly scenarioId?: string;
  readonly status?: RunStatus;
}

export interface EvaluationFilter {
  readonly runId?: string;
  readonly status?: EvaluationStatus;
}

export interface IStorage {
  // Setups
  getSetup(id: string): Promise<TestSetup | undefined>;
  listSetups(filter?: SetupFilter): Promise<readonly TestSetup[]>;
  saveSetup(setup: TestSetup): Promise<void>;
  deleteSetup(id: string): Promise<boolean>;

  // Scenarios
  getScenario(id: string): Promise<Scenario | undefined>;
  listScenarios(filter?: ScenarioFilter): Promise<readonly Scenario[]>;
  saveScenario(scenario: Scenario): Promise<void>;
  deleteScenario(id: string): Promise<boolean>;

  // Runs
  getRun(id: string): Promise<Run | undefined>;
  listRuns(filter?: RunFilter): Promise<readonly Run[]>;
  saveRun(run: Run): Promise<void>;
  deleteRun(id: string): Promise<boolean>;

  // Evaluations
  getEvaluation(id: string): Promise<Evaluation | undefined>;
  listEvaluations(filter?: EvaluationFilter): Promise<readonly Evaluation[]>;
  saveEvaluation(evaluation: Evaluation): Promise<void>;
  deleteEvaluation(id: string): Promise<boolean>;
}

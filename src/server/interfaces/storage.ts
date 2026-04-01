import type {
  Provider,
  Scenario,
  ScenarioCategory,
  Run,
  RunStatus,
  Evaluation,
  EvaluationStatus,
} from '../types/index.js';

export interface ProviderFilter {
  readonly provider?: string;
  readonly model?: string;
}

export interface ScenarioFilter {
  readonly category?: ScenarioCategory;
}

export interface RunFilter {
  readonly providerId?: string;
  readonly scenarioId?: string;
  readonly status?: RunStatus;
}

export interface EvaluationFilter {
  readonly runId?: string;
  readonly status?: EvaluationStatus;
}

export interface IStorage {
  // Providers
  getProvider(id: string): Promise<Provider | undefined>;
  listProviders(filter?: ProviderFilter): Promise<readonly Provider[]>;
  saveProvider(provider: Provider): Promise<void>;
  deleteProvider(id: string): Promise<boolean>;

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

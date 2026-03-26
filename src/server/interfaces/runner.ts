import type { Provider, Scenario, Run, RunStatus, SDKMessageRecord } from '../types/index.js';

export interface RunCallbacks {
  onMessage(message: SDKMessageRecord): void;
  onStatusChange(status: RunStatus): void;
}

export interface IRunner {
  executeRun(
    provider: Provider,
    scenario: Scenario,
    run: Run,
    callbacks: RunCallbacks,
    abortController?: AbortController,
  ): Promise<Run>;
}

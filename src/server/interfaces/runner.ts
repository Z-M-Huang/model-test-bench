import type { TestSetup, Scenario, Run, RunStatus, SDKMessageRecord } from '../types/index.js';

export interface RunCallbacks {
  onMessage(message: SDKMessageRecord): void;
  onStatusChange(status: RunStatus): void;
}

export interface IRunner {
  executeRun(
    setup: TestSetup,
    scenario: Scenario,
    run: Run,
    callbacks: RunCallbacks,
  ): Promise<Run>;
}

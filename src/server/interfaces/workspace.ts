import type { TestSetup, Scenario } from '../types/index.js';

export interface WorkspaceResult {
  readonly workspacePath: string;
  readonly cleanup: () => Promise<void>;
}

export interface IWorkspaceBuilder {
  createWorkspace(setup: TestSetup, scenario: Scenario): Promise<WorkspaceResult>;
}
